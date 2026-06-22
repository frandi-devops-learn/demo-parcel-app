import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Bell,
  Box,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Download,
  Gauge,
  Home,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  MoreVertical,
  Package,
  PackagePlus,
  Pencil,
  RefreshCcw,
  Search,
  ShieldCheck,
  Trash2,
  Truck,
  UsersRound,
  X,
  Zap
} from 'lucide-react';
import './styles.css';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const emptyForm = {
  senderName: '',
  senderPhone: '',
  recipientName: '',
  recipientPhone: '',
  originCity: '',
  destinationCity: '',
  pickupAddress: '',
  deliveryAddress: '',
  weightKg: '1.0',
  status: 'created',
  estimatedDelivery: getDefaultDeliveryDate(),
  notes: ''
};

const pageConfig = {
  dashboard: { title: 'Dashboard', subtitle: 'Operations overview' },
  orders: { title: 'Orders', subtitle: 'Parcel order queue' },
  customers: { title: 'Customers', subtitle: 'Recipient and sender directory' },
  shipments: { title: 'Shipments', subtitle: 'Live parcel operations' },
  reports: { title: 'Reports', subtitle: 'Delivery performance summaries' }
};

const sidebarItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'orders', label: 'Orders', icon: Box },
  { id: 'customers', label: 'Customers', icon: UsersRound },
  { id: 'shipments', label: 'Shipments', icon: Truck },
  { id: 'reports', label: 'Reports', icon: ClipboardList }
];

const statusOptions = [
  { value: 'created', label: 'Created' },
  { value: 'picked_up', label: 'Picked up' },
  { value: 'in_transit', label: 'In transit' },
  { value: 'out_for_delivery', label: 'Out for delivery' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'delayed', label: 'Delayed' }
];

const statusTone = {
  created: 'neutral',
  picked_up: 'blue',
  in_transit: 'amber',
  out_for_delivery: 'violet',
  delivered: 'green',
  delayed: 'red'
};

function App() {
  const [session, setSession] = useState(() => readStoredSession());
  const [loginForm, setLoginForm] = useState({
    email: 'admin@parcel.test',
    password: 'admin123'
  });
  const [activePage, setActivePage] = useState('dashboard');
  const [parcels, setParcels] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState('');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [selectedParcelIds, setSelectedParcelIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState('');
  const [error, setError] = useState('');

  const locations = useMemo(() => {
    return Array.from(new Set(parcels.flatMap((parcel) => [parcel.originCity, parcel.destinationCity]).filter(Boolean))).sort();
  }, [parcels]);

  const metrics = useMemo(() => {
    const active = parcels.filter((parcel) => parcel.status !== 'delivered').length;
    const delivered = parcels.filter((parcel) => parcel.status === 'delivered').length;
    const delayed = parcels.filter((parcel) => parcel.status === 'delayed').length;
    const onDelivery = parcels.filter((parcel) => parcel.status === 'out_for_delivery').length;
    const totalWeight = parcels.reduce((sum, parcel) => sum + parcel.weightKg, 0);
    const uniqueCustomers = new Set(parcels.map((parcel) => parcel.recipientPhone || parcel.recipientName)).size;

    return { active, delivered, delayed, onDelivery, totalWeight, uniqueCustomers };
  }, [parcels]);

  const filteredParcels = useMemo(() => {
    return parcels.filter((parcel) => {
      const matchesSearch = matchesParcelSearch(parcel, search);
      const matchesStatus = statusFilter === 'all' || parcel.status === statusFilter;
      const matchesLocation =
        locationFilter === 'all' || parcel.originCity === locationFilter || parcel.destinationCity === locationFilter;

      return matchesSearch && matchesStatus && matchesLocation;
    });
  }, [locationFilter, parcels, search, statusFilter]);

  const customers = useMemo(() => buildCustomers(parcels, search), [parcels, search]);
  const reports = useMemo(() => buildReports(parcels), [parcels]);

  useEffect(() => {
    if (session?.token) {
      loadParcels(session.token);
    } else {
      setLoading(false);
    }
  }, [session?.token]);

  async function login(event) {
    event.preventDefault();
    setLoggingIn(true);
    setError('');

    try {
      const response = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });
      const data = await parseResponse(response);
      localStorage.setItem('parcelSession', JSON.stringify(data));
      setSession(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoggingIn(false);
    }
  }

  function logout() {
    localStorage.removeItem('parcelSession');
    setSession(null);
    setParcels([]);
    closeEditor();
  }

  async function loadParcels(token = session?.token) {
    setLoading(true);
    setError('');

    try {
      const response = await apiFetch('/parcels', { token, onUnauthorized: logout });
      const data = await parseResponse(response);
      setParcels(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveParcel(event) {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const path = editingId ? `/parcels/${editingId}` : '/parcels';
      const method = editingId ? 'PUT' : 'POST';
      const response = await apiFetch(path, {
        method,
        body: JSON.stringify(form),
        token: session.token,
        onUnauthorized: logout
      });
      const saved = await parseResponse(response);

      if (editingId) {
        setParcels((current) => current.map((parcel) => (parcel.id === saved.id ? saved : parcel)));
      } else {
        setSearch('');
        setStatusFilter('all');
        setLocationFilter('all');
        setActivePage('shipments');
        setParcels((current) => [saved, ...current]);
        await loadParcels(session.token);
      }

      closeEditor();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id, status) {
    setUpdatingStatusId(id);
    setError('');

    try {
      const response = await apiFetch(`/parcels/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
        token: session.token,
        onUnauthorized: logout
      });
      const updated = await parseResponse(response);
      setParcels((current) => current.map((parcel) => (parcel.id === id ? updated : parcel)));
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingStatusId('');
    }
  }

  async function deleteParcel(id) {
    setError('');

    try {
      const response = await apiFetch(`/parcels/${id}`, {
        method: 'DELETE',
        token: session.token,
        onUnauthorized: logout
      });

      if (!response.ok) {
        await parseResponse(response);
      }

      setParcels((current) => current.filter((parcel) => parcel.id !== id));
      setSelectedParcelIds((current) => current.filter((selectedId) => selectedId !== id));

      if (editingId === id) {
        closeEditor();
      }
    } catch (err) {
      setError(err.message);
    }
  }

  function openCreateEditor() {
    setEditingId('');
    setForm(emptyForm);
    setIsEditorOpen(true);
  }

  function editParcel(parcel) {
    setEditingId(parcel.id);
    setForm({
      senderName: parcel.senderName,
      senderPhone: parcel.senderPhone,
      recipientName: parcel.recipientName,
      recipientPhone: parcel.recipientPhone,
      originCity: parcel.originCity,
      destinationCity: parcel.destinationCity,
      pickupAddress: parcel.pickupAddress,
      deliveryAddress: parcel.deliveryAddress,
      weightKg: String(parcel.weightKg),
      status: parcel.status,
      estimatedDelivery: toInputDate(parcel.estimatedDelivery),
      notes: parcel.notes || ''
    });
    setIsEditorOpen(true);
  }

  function closeEditor() {
    setEditingId('');
    setForm(emptyForm);
    setIsEditorOpen(false);
  }

  function setFormValue(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function toggleParcelSelection(id) {
    setSelectedParcelIds((current) =>
      current.includes(id) ? current.filter((selectedId) => selectedId !== id) : [...current, id]
    );
  }

  function toggleVisibleParcelSelection(visibleParcels) {
    const visibleIds = visibleParcels.map((parcel) => parcel.id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedParcelIds.includes(id));

    setSelectedParcelIds((current) => {
      if (allVisibleSelected) {
        return current.filter((id) => !visibleIds.includes(id));
      }

      return Array.from(new Set([...current, ...visibleIds]));
    });
  }

  function exportShipments(rows = filteredParcels) {
    const selectedRows = rows.filter((parcel) => selectedParcelIds.includes(parcel.id));
    exportParcelsToCsv(selectedRows.length > 0 ? selectedRows : rows);
  }

  if (!session?.token) {
    return (
      <main className="login-shell">
        <section className="login-visual" aria-label="Z Flash operations summary">
          <Logo />
          <div>
            <p className="eyebrow">Courier operations portal</p>
            <h1>Z Flash Express</h1>
            <p>Track parcel flow, customer activity, and delivery status from one focused admin workspace.</p>
          </div>
          <div className="login-stat-grid">
            <div>
              <strong>24/7</strong>
              <span>Live parcel monitoring</span>
            </div>
            <div>
              <strong>CSV</strong>
              <span>Shipment export ready</span>
            </div>
          </div>
        </section>
        <form className="login-panel" onSubmit={login}>
          <p className="eyebrow">Secure access</p>
          <h2>Sign in to dashboard</h2>
          <p className="login-copy">Use your admin account to manage parcels, customers, reports, and courier status updates.</p>
          <Field
            className="login-field"
            label="Email"
            type="email"
            value={loginForm.email}
            onChange={(value) => setLoginForm((current) => ({ ...current, email: value }))}
            required
          />
          <Field
            className="login-field"
            label="Password"
            type="password"
            value={loginForm.password}
            onChange={(value) => setLoginForm((current) => ({ ...current, password: value }))}
            required
          />
          {error && <p className="error-message">{error}</p>}
          <button className="primary-button login-submit" disabled={loggingIn} type="submit">
            {loggingIn ? <LoaderCircle className="spin" size={18} /> : <ShieldCheck size={18} />}
            {loggingIn ? 'Signing in' : 'Sign in'}
          </button>
          <div className="login-footnote">
            <span>Demo admin</span>
            <strong>admin@parcel.test</strong>
          </div>
          <p className="login-copyright">Z Flash Technology all rights reserved 2026.</p>
        </form>
      </main>
    );
  }

  return (
    <main className="dashboard-shell">
      <aside className="sidebar">
        <Logo />
        <nav className="sidebar-nav">
          {sidebarItems.map((item) => (
            <button
              className={`nav-item ${activePage === item.id ? 'active' : ''}`}
              key={item.id}
              onClick={() => setActivePage(item.id)}
              type="button"
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <section className="content-pane">
        <header className="topbar">
          <div>
            <h1>{pageConfig[activePage].title}</h1>
            <p>{pageConfig[activePage].subtitle}</p>
          </div>
          <label className="global-search">
            <Search size={18} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tracking, name, phone, route..." />
          </label>
          <div className="top-actions">
            <button className="round-button notification" title="Notifications" type="button">
              <Bell size={18} />
            </button>
            <button className="avatar-button" title={session.user.email} type="button">
              {getInitials(session.user.name)}
            </button>
            <button className="round-button" onClick={logout} title="Sign out" type="button">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {error && <p className="page-error">{error}</p>}
        {loading && <p className="empty-state">Loading parcel data...</p>}
        {!loading && (
          <PageContent
            activePage={activePage}
            customers={customers}
            deleteParcel={deleteParcel}
            editParcel={editParcel}
            filteredParcels={filteredParcels}
            locationFilter={locationFilter}
            locations={locations}
            metrics={metrics}
            openCreateEditor={openCreateEditor}
            parcels={parcels}
            reports={reports}
            search={search}
            selectedParcelIds={selectedParcelIds}
            session={session}
            setLocationFilter={setLocationFilter}
            setSearch={setSearch}
            setStatusFilter={setStatusFilter}
            statusFilter={statusFilter}
            toggleParcelSelection={toggleParcelSelection}
            toggleVisibleParcelSelection={toggleVisibleParcelSelection}
            updateStatus={updateStatus}
            updatingStatusId={updatingStatusId}
            exportShipments={exportShipments}
          />
        )}
      </section>

      {isEditorOpen && (
        <EditorModal
          closeEditor={closeEditor}
          editingId={editingId}
          form={form}
          saveParcel={saveParcel}
          saving={saving}
          setFormValue={setFormValue}
        />
      )}
    </main>
  );
}

function PageContent(props) {
  switch (props.activePage) {
    case 'dashboard':
      return <DashboardPage {...props} />;
    case 'orders':
      return <OrdersPage {...props} />;
    case 'customers':
      return <CustomersPage {...props} />;
    case 'reports':
      return <ReportsPage {...props} />;
    case 'shipments':
    default:
      return <ShipmentsPage {...props} />;
  }
}

function DashboardPage({ metrics, openCreateEditor, parcels, reports, setSearch, setStatusFilter, setLocationFilter, updateStatus, updatingStatusId }) {
  const recent = parcels.slice(0, 5);
  const critical = parcels.filter((parcel) => parcel.status === 'delayed' || parcel.status === 'out_for_delivery').slice(0, 4);

  return (
    <>
      <MetricsStrip metrics={metrics} parcels={parcels} />
      <section className="page-grid dashboard-grid">
        <article className="panel-card hero-panel">
          <p className="eyebrow">Today</p>
          <h2>{metrics.active} active parcels moving through Z Flash</h2>
          <p>Keep the queue healthy by clearing delayed deliveries and updating out-for-delivery parcels as they complete.</p>
          <div className="hero-actions">
            <button className="primary-button compact" onClick={openCreateEditor} type="button">
              <PackagePlus size={17} />
              New parcel
            </button>
            <button
              className="secondary-button"
              onClick={() => {
                setStatusFilter('delayed');
                setLocationFilter('all');
                setSearch('');
              }}
              type="button"
            >
              Review delays
            </button>
          </div>
        </article>

        <article className="panel-card">
          <PanelTitle title="Status Mix" subtitle="Current parcel lifecycle" />
          <div className="status-bars">
            {reports.statusRows.map((row) => (
              <div className="status-bar" key={row.status}>
                <span>{row.label}</span>
                <strong>{row.count}</strong>
                <i style={{ width: `${row.percent}%` }} />
              </div>
            ))}
          </div>
        </article>

        <article className="panel-card wide-panel">
          <PanelTitle title="Priority Queue" subtitle="Delayed and out-for-delivery parcels" />
          <CompactParcelList parcels={critical.length ? critical : recent} updateStatus={updateStatus} updatingStatusId={updatingStatusId} />
        </article>

        <article className="panel-card">
          <PanelTitle title="Top Routes" subtitle="Most frequent destinations" />
          <RouteList routes={reports.routeRows.slice(0, 5)} />
        </article>
      </section>
    </>
  );
}

function OrdersPage(props) {
  return (
    <section className="table-card page-table">
      <TableHeader
        actionLabel="Create order"
        count={props.filteredParcels.length}
        description="Orders are new parcel requests. Once created, the same record appears in Shipments for delivery tracking."
        openCreateEditor={props.openCreateEditor}
        setSearch={props.setSearch}
        search={props.search}
        title="Order Queue"
      />
      <ParcelTable {...props} mode="orders" />
    </section>
  );
}

function CustomersPage({ customers, metrics, parcels }) {
  const repeatCustomers = customers.filter((customer) => customer.parcels > 1).length;
  const activeCustomers = customers.filter((customer) => customer.activeParcels > 0).length;
  const delayedCustomers = customers.filter((customer) => customer.delayedParcels > 0).length;
  const topCustomers = [...customers].sort((a, b) => b.parcels - a.parcels).slice(0, 4);

  return (
    <section className="page-grid customers-grid">
      <article className="panel-card customer-summary-card">
        <PanelTitle title="Customer Overview" subtitle="Generated from parcel recipients" />
        <div className="segment-list">
          <Segment label="Total customers" value={customers.length} />
          <Segment label="Repeat customers" value={repeatCustomers} />
          <Segment label="Active customers" value={activeCustomers} />
          <Segment label="Delayed customers" value={delayedCustomers} />
        </div>
      </article>
      <article className="panel-card customer-summary-card">
        <PanelTitle title="Customer Health" subtitle="Service quality snapshot" />
        <div className="report-kpis">
          <ReportKpi label="Delivered parcels" value={metrics.delivered} />
          <ReportKpi label="Pending parcels" value={metrics.active} />
          <ReportKpi label="All parcel weight" value={`${metrics.totalWeight.toFixed(1)} kg`} />
          <ReportKpi label="Customer base" value={parcels.length ? `${Math.round((customers.length / parcels.length) * 100)}%` : '0%'} />
        </div>
      </article>
      <article className="panel-card wide-panel">
        <PanelTitle title="Customer Directory" subtitle={`${customers.length} profiles with shipment activity`} />
        <div className="customer-list">
          {customers.map((customer) => (
            <div className="customer-row" key={`${customer.name}-${customer.phone}`}>
              <span className="parcel-avatar">{getInitials(customer.name)}</span>
              <div className="customer-main">
                <strong>{customer.name}</strong>
                <span className="customer-meta">
                  <small>{customer.phone || 'No phone'}</small>
                  <small>{customer.city || 'No city'}</small>
                </span>
                <small className="customer-address">{customer.address || 'No delivery address'}</small>
              </div>
              <div className="customer-stats">
                <strong>{customer.parcels}</strong>
                <small>parcels</small>
              </div>
              <div className="customer-stats">
                <strong>{customer.totalWeight.toFixed(1)} kg</strong>
                <small>total weight</small>
              </div>
              <div className="customer-stats">
                <strong>{customer.lastTracking}</strong>
                <small>latest parcel</small>
              </div>
              <span className={`status-select ${customer.lastStatusTone}`}>{customer.lastStatus}</span>
            </div>
          ))}
          {customers.length === 0 && <p className="empty-state">No customers match the current search.</p>}
        </div>
      </article>
      <article className="panel-card">
        <PanelTitle title="Top Customers" subtitle="Highest parcel volume" />
        <CustomerMiniList customers={topCustomers} />
      </article>
      <article className="panel-card">
        <PanelTitle title="Attention Needed" subtitle="Customers with delayed parcels" />
        <CustomerMiniList customers={customers.filter((customer) => customer.delayedParcels > 0).slice(0, 4)} emptyText="No delayed customer parcels." />
      </article>
    </section>
  );
}

function ShipmentsPage(props) {
  return (
    <>
      <MetricsStrip metrics={props.metrics} parcels={props.parcels} />
      <section className="table-card">
        <ShipmentFilters {...props} />
        <ParcelTable {...props} mode="shipments" />
      </section>
    </>
  );
}

function ReportsPage({ metrics, parcels, reports }) {
  return (
    <>
      <MetricsStrip metrics={metrics} parcels={parcels} />
      <section className="page-grid reports-grid">
        <article className="panel-card">
          <PanelTitle title="Delivery Performance" subtitle="Status distribution" />
          <div className="status-bars large">
            {reports.statusRows.map((row) => (
              <div className="status-bar" key={row.status}>
                <span>{row.label}</span>
                <strong>{row.count}</strong>
                <i style={{ width: `${row.percent}%` }} />
              </div>
            ))}
          </div>
        </article>
        <article className="panel-card">
          <PanelTitle title="Load Summary" subtitle="Parcel volume and weight" />
          <div className="report-kpis">
            <ReportKpi label="Total parcels" value={parcels.length} />
            <ReportKpi label="Active load" value={metrics.active} />
            <ReportKpi label="Total weight" value={`${metrics.totalWeight.toFixed(1)} kg`} />
            <ReportKpi label="Delay rate" value={`${parcels.length ? Math.round((metrics.delayed / parcels.length) * 100) : 0}%`} />
          </div>
        </article>
        <article className="panel-card wide-panel">
          <PanelTitle title="Route Report" subtitle="Most common delivery lanes" />
          <RouteList routes={reports.routeRows} />
        </article>
      </section>
    </>
  );
}

function MetricsStrip({ metrics, parcels }) {
  return (
    <section className="metrics-strip">
      <Metric icon={<Package />} label="Total Parcels" value={parcels.length} trend="18.6%" />
      <Metric icon={<Truck />} label="Active Parcels" value={metrics.active} trend="12.4%" />
      <Metric icon={<Home />} label="Out For Delivery" value={metrics.onDelivery} trend="8.2%" />
      <Metric icon={<CheckCircle2 />} label="Completed" value={metrics.delivered} trend="15.7%" />
      <Metric icon={<Gauge />} label="Delayed" value={metrics.delayed} trend="6.3%" down />
    </section>
  );
}

function ShipmentFilters(props) {
  return (
    <div className="filter-row">
      <FilterField label="Search">
        <Search size={17} />
        <input value={props.search} onChange={(event) => props.setSearch(event.target.value)} placeholder="Parcels..." />
      </FilterField>
      <FilterField label="Status">
        <select value={props.statusFilter} onChange={(event) => props.setStatusFilter(event.target.value)}>
          <option value="all">All Status</option>
          {statusOptions.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
        </select>
        <ChevronDown size={15} />
      </FilterField>
      <FilterField label="Location">
        <select value={props.locationFilter} onChange={(event) => props.setLocationFilter(event.target.value)}>
          <option value="all">All Location</option>
          {props.locations.map((location) => (
            <option key={location} value={location}>
              {location}
            </option>
          ))}
        </select>
        <ChevronDown size={15} />
      </FilterField>
      <div className="filter-actions">
        <button className="primary-button compact" onClick={props.openCreateEditor} type="button">
          <PackagePlus size={17} />
          Add parcel
        </button>
        <button className="square-button" onClick={() => props.exportShipments(props.filteredParcels)} title="Download CSV" type="button">
          <Download size={17} />
        </button>
      </div>
    </div>
  );
}

function TableHeader({ actionLabel, count, description, openCreateEditor, search, setSearch, title }) {
  return (
    <div className="table-title-row">
      <div>
        <h2>{title}</h2>
        <p>{description || `${count} records in this view`}</p>
        {description && <small>{count} records in this view</small>}
      </div>
      <div className="filter-actions">
        <FilterField label="Search">
          <Search size={17} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search records..." />
        </FilterField>
        <button className="primary-button compact" onClick={openCreateEditor} type="button">
          <PackagePlus size={17} />
          {actionLabel}
        </button>
      </div>
    </div>
  );
}

function ParcelTable({
  deleteParcel,
  editParcel,
  filteredParcels,
  mode,
  parcels,
  selectedParcelIds,
  toggleParcelSelection,
  toggleVisibleParcelSelection,
  updateStatus,
  updatingStatusId
}) {
  const allVisibleSelected =
    filteredParcels.length > 0 && filteredParcels.every((parcel) => selectedParcelIds.includes(parcel.id));

  return (
    <>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>
                <input
                  aria-label="Select all visible parcels"
                  checked={allVisibleSelected}
                  className="checkbox"
                  onChange={() => toggleVisibleParcelSelection(filteredParcels)}
                  type="checkbox"
                />
              </th>
              <th>{mode === 'orders' ? 'Order' : 'Parcel'}</th>
              <th>Contact</th>
              <th>Route</th>
              <th>Weight</th>
              <th>ETA</th>
              <th>Status</th>
              <th>Location</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredParcels.length === 0 && (
              <tr>
                <td colSpan="9">
                  <p className="empty-state">No records match the current view.</p>
                </td>
              </tr>
            )}
            {filteredParcels.map((parcel) => (
              <tr key={parcel.id}>
                <td>
                  <input
                    aria-label={`Select ${parcel.trackingNumber}`}
                    checked={selectedParcelIds.includes(parcel.id)}
                    className="checkbox"
                    onChange={() => toggleParcelSelection(parcel.id)}
                    type="checkbox"
                  />
                </td>
                <td>
                  <div className="parcel-cell">
                    <span className="parcel-avatar">{getInitials(parcel.recipientName)}</span>
                    <div>
                      <strong>{mode === 'orders' ? parcel.trackingNumber : parcel.recipientName}</strong>
                      <small>{mode === 'orders' ? parcel.recipientName : parcel.trackingNumber}</small>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="stacked">
                    <strong>{parcel.recipientPhone}</strong>
                    <small>{parcel.senderName}</small>
                  </div>
                </td>
                <td>
                  <div className="stacked">
                    <strong>{parcel.originCity}</strong>
                    <small>to {parcel.destinationCity}</small>
                  </div>
                </td>
                <td>{parcel.weightKg.toFixed(1)} kg</td>
                <td>{formatDate(parcel.estimatedDelivery)}</td>
                <td>
                  <select
                    className={`status-select ${statusTone[parcel.status]}`}
                    disabled={updatingStatusId === parcel.id}
                    value={parcel.status}
                    onChange={(event) => updateStatus(parcel.id, event.target.value)}
                  >
                    {statusOptions.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td>{parcel.destinationCity}</td>
                <td>
                  <div className="table-actions">
                    <button className="table-icon" onClick={() => editParcel(parcel)} title="Edit parcel" type="button">
                      <Pencil size={16} />
                    </button>
                    <button className="table-icon danger" onClick={() => deleteParcel(parcel.id)} title="Delete parcel" type="button">
                      <Trash2 size={16} />
                    </button>
                    <button className="table-icon" title="More actions" type="button">
                      <MoreVertical size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <footer className="pagination-row">
        <span>
          Showing {filteredParcels.length === 0 ? 0 : 1} to {filteredParcels.length} of {parcels.length} records
        </span>
        <div className="pagination">
          <button type="button">‹</button>
          <button className="active" type="button">1</button>
          <button type="button">2</button>
          <button type="button">3</button>
          <button type="button">›</button>
        </div>
      </footer>
    </>
  );
}

function EditorModal({ closeEditor, editingId, form, saveParcel, saving, setFormValue }) {
  return (
    <div className="modal-backdrop">
      <form className="editor-modal" onSubmit={saveParcel}>
        <header>
          <div>
            <p className="eyebrow">Shipment details</p>
            <h2>{editingId ? 'Edit parcel' : 'Add parcel'}</h2>
          </div>
          <button className="round-button" onClick={closeEditor} title="Close" type="button">
            <X size={18} />
          </button>
        </header>
        <div className="modal-grid">
          <Field label="Sender name" value={form.senderName} onChange={(value) => setFormValue('senderName', value)} required />
          <Field label="Sender phone" value={form.senderPhone} onChange={(value) => setFormValue('senderPhone', value)} required />
          <Field label="Recipient name" value={form.recipientName} onChange={(value) => setFormValue('recipientName', value)} required />
          <Field label="Recipient phone" value={form.recipientPhone} onChange={(value) => setFormValue('recipientPhone', value)} required />
          <Field label="Origin city" value={form.originCity} onChange={(value) => setFormValue('originCity', value)} required />
          <Field label="Destination city" value={form.destinationCity} onChange={(value) => setFormValue('destinationCity', value)} required />
          <Field label="Weight kg" type="number" min="0.1" step="0.1" value={form.weightKg} onChange={(value) => setFormValue('weightKg', value)} required />
          <Field label="ETA" type="date" value={form.estimatedDelivery} onChange={(value) => setFormValue('estimatedDelivery', value)} required />
          <Field className="wide" label="Pickup address" value={form.pickupAddress} onChange={(value) => setFormValue('pickupAddress', value)} required />
          <Field className="wide" label="Delivery address" value={form.deliveryAddress} onChange={(value) => setFormValue('deliveryAddress', value)} required />
          <label className="field">
            <span>Status</span>
            <select value={form.status} onChange={(event) => setFormValue('status', event.target.value)}>
              {statusOptions.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Notes</span>
            <textarea value={form.notes} onChange={(event) => setFormValue('notes', event.target.value)} rows="3" />
          </label>
        </div>
        <footer>
          <button className="secondary-button" onClick={closeEditor} type="button">
            Cancel
          </button>
          <button className="primary-button compact" disabled={saving} type="submit">
            {saving ? <LoaderCircle className="spin" size={18} /> : <Check size={18} />}
            {editingId ? 'Save changes' : 'Create parcel'}
          </button>
        </footer>
      </form>
    </div>
  );
}

function CompactParcelList({ parcels, updateStatus, updatingStatusId }) {
  return (
    <div className="compact-list">
      {parcels.map((parcel) => (
        <div className="compact-row" key={parcel.id}>
          <span className="parcel-avatar">{getInitials(parcel.recipientName)}</span>
          <div className="compact-main">
            <strong>{parcel.trackingNumber}</strong>
            <small>{parcel.originCity} to {parcel.destinationCity}</small>
          </div>
          <select
            className={`status-select ${statusTone[parcel.status]}`}
            disabled={updatingStatusId === parcel.id}
            value={parcel.status}
            onChange={(event) => updateStatus(parcel.id, event.target.value)}
          >
            {statusOptions.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </div>
      ))}
      {parcels.length === 0 && <p className="empty-state">No parcels yet.</p>}
    </div>
  );
}

function RouteList({ routes }) {
  return (
    <div className="route-list">
      {routes.map((route) => (
        <div className="route-row" key={route.route}>
          <span>{route.route}</span>
          <strong>{route.count}</strong>
        </div>
      ))}
      {routes.length === 0 && <p className="empty-state">No route data available.</p>}
    </div>
  );
}

function Segment({ label, value }) {
  return (
    <div className="segment-card">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function CustomerMiniList({ customers, emptyText = 'No customers available.' }) {
  return (
    <div className="mini-list">
      {customers.map((customer) => (
        <div className="mini-row" key={`${customer.name}-${customer.phone}`}>
          <span className="parcel-avatar">{getInitials(customer.name)}</span>
          <div className="mini-main">
            <strong>{customer.name}</strong>
            <small>{customer.parcels} parcels · {customer.city || 'No city'}</small>
          </div>
          <span className={`status-select ${customer.lastStatusTone}`}>{customer.lastStatus}</span>
        </div>
      ))}
      {customers.length === 0 && <p className="empty-state">{emptyText}</p>}
    </div>
  );
}

function ReportKpi({ label, value }) {
  return (
    <div className="report-kpi">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function PanelTitle({ title, subtitle }) {
  return (
    <div className="panel-title">
      <h2>{title}</h2>
      <p>{subtitle}</p>
    </div>
  );
}

function Logo() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <Zap size={22} />
      </span>
      <strong>Z Flash</strong>
    </div>
  );
}

function Metric({ icon, label, value, trend, down = false }) {
  return (
    <article className="metric-card">
      <div className="metric-icon">{icon}</div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <small className={down ? 'trend down' : 'trend'}>{down ? '▼' : '▲'} {trend}</small>
      </div>
    </article>
  );
}

function FilterField({ label, children }) {
  return (
    <label className="filter-field">
      <span>{label}</span>
      <div>{children}</div>
    </label>
  );
}

function Field({ className = '', label, onChange, ...props }) {
  return (
    <label className={`field ${className}`}>
      <span>{label}</span>
      <input {...props} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function buildCustomers(parcels, search) {
  const map = new Map();

  parcels.forEach((parcel) => {
    const key = `${parcel.recipientName.trim().toLowerCase()}|${parcel.recipientPhone.trim()}`;
    const current = map.get(key) || {
      name: parcel.recipientName,
      phone: parcel.recipientPhone,
      city: parcel.destinationCity,
      address: parcel.deliveryAddress,
      parcels: 0,
      activeParcels: 0,
      delayedParcels: 0,
      totalWeight: 0,
      lastTracking: parcel.trackingNumber,
      lastStatus: statusLabel(parcel.status),
      lastStatusTone: statusTone[parcel.status]
    };

    current.parcels += 1;
    current.activeParcels += parcel.status !== 'delivered' ? 1 : 0;
    current.delayedParcels += parcel.status === 'delayed' ? 1 : 0;
    current.totalWeight += parcel.weightKg;
    current.city = parcel.destinationCity;
    current.address = parcel.deliveryAddress;
    current.lastTracking = parcel.trackingNumber;
    current.lastStatus = statusLabel(parcel.status);
    current.lastStatusTone = statusTone[parcel.status];
    map.set(key, current);
  });

  const query = search.trim().toLowerCase();
  return Array.from(map.values()).filter((customer) =>
    !query ||
    [customer.name, customer.phone, customer.city, customer.address, customer.lastTracking, customer.lastStatus]
      .join(' ')
      .toLowerCase()
      .includes(query)
  );
}

function buildReports(parcels) {
  const statusRows = statusOptions.map((status) => {
    const count = parcels.filter((parcel) => parcel.status === status.value).length;
    return {
      status: status.value,
      label: status.label,
      count,
      percent: parcels.length ? Math.max(4, Math.round((count / parcels.length) * 100)) : 0
    };
  });

  const routes = new Map();
  parcels.forEach((parcel) => {
    const route = `${parcel.originCity} to ${parcel.destinationCity}`;
    routes.set(route, (routes.get(route) || 0) + 1);
  });

  const routeRows = Array.from(routes.entries())
    .map(([route, count]) => ({ route, count }))
    .sort((a, b) => b.count - a.count);

  return { statusRows, routeRows };
}

function matchesParcelSearch(parcel, search) {
  const query = search.trim().toLowerCase();

  if (!query) {
    return true;
  }

  return [
    parcel.trackingNumber,
    parcel.senderName,
    parcel.senderPhone,
    parcel.recipientName,
    parcel.recipientPhone,
    parcel.originCity,
    parcel.destinationCity,
    parcel.status
  ]
    .join(' ')
    .toLowerCase()
    .includes(query);
}

async function parseResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    throw new Error(body?.message || `Request failed with status ${response.status}`);
  }

  return body;
}

async function apiFetch(path, options = {}) {
  const { token, onUnauthorized, headers, ...fetchOptions } = options;
  const response = await fetch(`${apiUrl}${path}`, {
    ...fetchOptions,
    headers: {
      ...(fetchOptions.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers
    }
  });

  if (response.status === 401 && onUnauthorized) {
    onUnauthorized();
  }

  return response;
}

function readStoredSession() {
  try {
    const value = localStorage.getItem('parcelSession');
    return value ? JSON.parse(value) : null;
  } catch (_error) {
    localStorage.removeItem('parcelSession');
    return null;
  }
}

function formatDate(value) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(value));
}

function getDefaultDeliveryDate() {
  const date = new Date();
  date.setDate(date.getDate() + 3);
  return date.toISOString().slice(0, 10);
}

function toInputDate(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function getInitials(value) {
  return String(value || 'A')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function statusLabel(value) {
  return statusOptions.find((status) => status.value === value)?.label || value;
}

function exportParcelsToCsv(parcels) {
  if (parcels.length === 0) {
    return;
  }

  const headers = [
    'Tracking Number',
    'Sender Name',
    'Sender Phone',
    'Recipient Name',
    'Recipient Phone',
    'Origin City',
    'Destination City',
    'Weight Kg',
    'Status',
    'Estimated Delivery',
    'Pickup Address',
    'Delivery Address',
    'Notes'
  ];
  const rows = parcels.map((parcel) => [
    parcel.trackingNumber,
    parcel.senderName,
    parcel.senderPhone,
    parcel.recipientName,
    parcel.recipientPhone,
    parcel.originCity,
    parcel.destinationCity,
    parcel.weightKg,
    statusLabel(parcel.status),
    formatDate(parcel.estimatedDelivery),
    parcel.pickupAddress,
    parcel.deliveryAddress,
    parcel.notes
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = `z-flash-shipments-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

createRoot(document.getElementById('root')).render(<App />);
