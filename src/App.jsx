import React, { useEffect, useMemo, useState } from 'react';
import { supabase, isSupabaseConfigured } from './supabase';
import { Download, FileText, LogOut, Pencil, Plus, Save, Trash2, User, Wallet } from 'lucide-react';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';

const categorias = [
  'Supermercado',
  'Ropa',
  'Extrascolares',
  'Guardería / Comedor',
  'Ocio',
  'Luz',
  'Internet',
  'Comunidad',
  'Seguro',
  'Transporte / Coche',
  'Otros',
];

const presupuestosBase = Object.fromEntries(categorias.map((c) => [c, 0]));

const formatoEuro = (n) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(n || 0));

const monthKey = (dateString) => {
  const d = new Date(dateString);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const monthLabel = (key) => {
  const [y, m] = key.split('-');
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
};

function SetupBox() {
  return (
    <div className="setup-box">
      <h1>Economía Hogar</h1>
      <p>La app está preparada para funcionar con email + contraseña usando Supabase.</p>
      <p>
        Para activarla solo tienes que crear un proyecto en Supabase, copiar el archivo <strong>.env.example</strong> como <strong>.env</strong> y rellenar estas dos variables:
      </p>
      <pre>VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...</pre>
      <p>En el ZIP te dejo también el SQL de la base de datos y un README con los pasos.</p>
    </div>
  );
}

function AuthScreen({ onAuth }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onAuth?.();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name } },
        });
        if (error) throw error;
        if (data.user) {
          setMessage('Cuenta creada. Si tu proyecto exige confirmación por email, revísalo antes de entrar.');
        }
      }
    } catch (err) {
      setMessage(err.message || 'Ha ocurrido un error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="app-badge">Economía Hogar</div>
        <h1>{isLogin ? 'Entrar' : 'Crear cuenta'}</h1>
        <p>App compartida para controlar los gastos del hogar entre dos personas.</p>
        <form onSubmit={handleSubmit} className="form-grid">
          {!isLogin && (
            <label>
              Nombre
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" />
            </label>
          )}
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" required />
          </label>
          <label>
            Contraseña
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
          </label>
          <button className="primary" disabled={loading}>{loading ? 'Procesando...' : isLogin ? 'Entrar' : 'Crear cuenta'}</button>
        </form>
        <button className="linkish" onClick={() => setIsLogin(!isLogin)}>
          {isLogin ? 'No tengo cuenta todavía' : 'Ya tengo cuenta'}
        </button>
        {message && <div className="message">{message}</div>}
      </div>
    </div>
  );
}

function AppShell({ session }) {
  const todayMonth = monthKey(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [gastos, setGastos] = useState([]);
  const [presupuestos, setPresupuestos] = useState(presupuestosBase);
  const [selectedMonth, setSelectedMonth] = useState(todayMonth);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    fecha: new Date().toISOString().slice(0, 10),
    concepto: '',
    categoria: 'Supermercado',
    tipo: 'Variable',
    importe: '',
  });

  const loadData = async () => {
    setLoading(true);
    const { data: expenses, error: expensesError } = await supabase
      .from('expenses')
      .select('*')
      .order('fecha', { ascending: false });
    if (expensesError) {
      alert(expensesError.message);
      setLoading(false);
      return;
    }
    const { data: budgets, error: budgetsError } = await supabase
      .from('budgets')
      .select('*')
      .order('categoria');
    if (budgetsError) {
      alert(budgetsError.message);
      setLoading(false);
      return;
    }

    setGastos(expenses || []);
    const merged = { ...presupuestosBase };
    for (const row of budgets || []) merged[row.categoria] = Number(row.presupuesto || 0);
    setPresupuestos(merged);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    const channel = supabase
      .channel('economia-hogar-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'budgets' }, loadData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const months = useMemo(() => {
    const set = new Set(gastos.map((g) => monthKey(g.fecha)));
    set.add(todayMonth);
    return [...set].sort().reverse();
  }, [gastos, todayMonth]);

  const gastosMes = useMemo(() => gastos.filter((g) => monthKey(g.fecha) === selectedMonth), [gastos, selectedMonth]);
  const totalMes = useMemo(() => gastosMes.reduce((a, g) => a + Number(g.importe), 0), [gastosMes]);
  const totalFijos = useMemo(() => gastosMes.filter((g) => g.tipo === 'Fijo').reduce((a, g) => a + Number(g.importe), 0), [gastosMes]);
  const totalVariables = useMemo(() => gastosMes.filter((g) => g.tipo === 'Variable').reduce((a, g) => a + Number(g.importe), 0), [gastosMes]);
  const totalPresupuesto = useMemo(() => Object.values(presupuestos).reduce((a, n) => a + Number(n), 0), [presupuestos]);

  const resumenCategorias = useMemo(() => {
    const totals = Object.fromEntries(categorias.map((c) => [c, 0]));
    for (const g of gastosMes) totals[g.categoria] = (totals[g.categoria] || 0) + Number(g.importe);
    return categorias.map((categoria) => ({
      categoria,
      gastado: totals[categoria] || 0,
      presupuesto: Number(presupuestos[categoria] || 0),
      restante: Number(presupuestos[categoria] || 0) - Number(totals[categoria] || 0),
    }));
  }, [gastosMes, presupuestos]);

  const resetForm = () => {
    setEditingId(null);
    setForm({
      fecha: new Date().toISOString().slice(0, 10),
      concepto: '',
      categoria: 'Supermercado',
      tipo: 'Variable',
      importe: '',
    });
  };

  const saveExpense = async (e) => {
    e.preventDefault();
    const payload = {
      fecha: form.fecha,
      concepto: form.concepto.trim(),
      categoria: form.categoria,
      tipo: form.tipo,
      importe: Number(form.importe),
      creado_por: session.user.user_metadata?.name || session.user.email,
      user_id: session.user.id,
    };
    if (!payload.concepto || !payload.importe) return;

    if (editingId) {
      const { error } = await supabase.from('expenses').update(payload).eq('id', editingId);
      if (error) return alert(error.message);
    } else {
      const { error } = await supabase.from('expenses').insert(payload);
      if (error) return alert(error.message);
    }
    resetForm();
    loadData();
  };

  const editExpense = (expense) => {
    setEditingId(expense.id);
    setForm({
      fecha: expense.fecha,
      concepto: expense.concepto,
      categoria: expense.categoria,
      tipo: expense.tipo,
      importe: String(expense.importe),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteExpense = async (id) => {
    if (!confirm('¿Seguro que quieres borrar este gasto?')) return;
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) return alert(error.message);
    loadData();
  };

  const saveBudget = async (categoria, presupuesto) => {
    const { error } = await supabase.from('budgets').upsert({ categoria, presupuesto: Number(presupuesto || 0) }, { onConflict: 'categoria' });
    if (error) return alert(error.message);
  };

  const exportExcel = () => {
    const rows = gastos.map((g) => ({
      Fecha: g.fecha,
      Concepto: g.concepto,
      Categoria: g.categoria,
      Tipo: g.tipo,
      Importe: Number(g.importe),
      Usuario: g.creado_por,
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Gastos');
    XLSX.writeFile(wb, 'economia-hogar.xlsx');
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Economía Hogar', 14, 18);
    doc.setFontSize(11);
    doc.text(`Resumen de ${monthLabel(selectedMonth)}`, 14, 28);
    doc.text(`Total: ${formatoEuro(totalMes)}`, 14, 36);
    doc.text(`Fijos: ${formatoEuro(totalFijos)}`, 14, 42);
    doc.text(`Variables: ${formatoEuro(totalVariables)}`, 14, 48);
    let y = 60;
    gastosMes.forEach((g) => {
      if (y > 275) {
        doc.addPage();
        y = 20;
      }
      doc.text(`${g.fecha} · ${g.concepto} · ${g.categoria} · ${formatoEuro(g.importe)} · ${g.creado_por}`, 14, y);
      y += 7;
    });
    doc.save(`economia-hogar-${selectedMonth}.pdf`);
  };

  const userDisplay = session.user.user_metadata?.name || session.user.email;

  if (loading) return <div className="loading">Cargando datos...</div>;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <div className="app-badge">Economía Hogar</div>
          <h1>Control de gastos compartido</h1>
          <p>Dos usuarios, mismos datos y sincronización automática.</p>
        </div>
        <div className="top-actions">
          <div className="user-pill"><User size={16} /> {userDisplay}</div>
          <button className="ghost" onClick={exportExcel}><Download size={16} /> Excel</button>
          <button className="ghost" onClick={exportPDF}><FileText size={16} /> PDF</button>
          <button className="ghost" onClick={() => supabase.auth.signOut()}><LogOut size={16} /> Salir</button>
        </div>
      </header>

      <section className="stats-grid">
        <div className="stat-card"><Wallet size={18} /><span>Total mes</span><strong>{formatoEuro(totalMes)}</strong></div>
        <div className="stat-card"><span>Gastos fijos</span><strong>{formatoEuro(totalFijos)}</strong></div>
        <div className="stat-card"><span>Gastos variables</span><strong>{formatoEuro(totalVariables)}</strong></div>
        <div className="stat-card"><span>Presupuesto mensual</span><strong>{formatoEuro(totalPresupuesto)}</strong></div>
      </section>

      <div className="layout-grid">
        <section className="card">
          <h2>{editingId ? 'Editar gasto' : 'Añadir gasto'}</h2>
          <form className="form-grid" onSubmit={saveExpense}>
            <label>
              Fecha
              <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
            </label>
            <label>
              Importe
              <input type="number" step="0.01" value={form.importe} onChange={(e) => setForm({ ...form, importe: e.target.value })} placeholder="0,00" />
            </label>
            <label className="full">
              Concepto
              <input value={form.concepto} onChange={(e) => setForm({ ...form, concepto: e.target.value })} placeholder="Mercadona, colegio, recibo, ropa..." />
            </label>
            <label>
              Categoría
              <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
                {categorias.map((categoria) => <option key={categoria}>{categoria}</option>)}
              </select>
            </label>
            <label>
              Tipo
              <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                <option>Variable</option>
                <option>Fijo</option>
              </select>
            </label>
            <div className="row-buttons full">
              <button className="primary"><Save size={16} /> {editingId ? 'Guardar cambios' : 'Guardar gasto'}</button>
              {editingId && <button type="button" className="ghost" onClick={resetForm}>Cancelar</button>}
            </div>
          </form>
        </section>

        <section className="card">
          <h2>Mes a consultar</h2>
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
            {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
          <div className="budget-summary">
            <p><strong>Diferencia con presupuesto:</strong> {formatoEuro(totalPresupuesto - totalMes)}</p>
            <p><strong>Movimientos del mes:</strong> {gastosMes.length}</p>
          </div>
        </section>
      </div>

      <section className="card">
        <h2>Presupuesto por categoría</h2>
        <div className="budget-grid">
          {categorias.map((categoria) => (
            <label key={categoria} className="budget-item">
              <span>{categoria}</span>
              <input
                type="number"
                step="0.01"
                value={presupuestos[categoria]}
                onChange={(e) => setPresupuestos((prev) => ({ ...prev, [categoria]: e.target.value }))}
                onBlur={(e) => saveBudget(categoria, e.target.value)}
              />
            </label>
          ))}
        </div>
      </section>

      <div className="layout-grid">
        <section className="card">
          <h2>Resumen por categorías · {monthLabel(selectedMonth)}</h2>
          <div className="summary-list">
            {resumenCategorias.map((item) => (
              <div key={item.categoria} className="summary-row">
                <div>
                  <strong>{item.categoria}</strong>
                  <p>Presupuesto: {formatoEuro(item.presupuesto)} · Restante: {formatoEuro(item.restante)}</p>
                </div>
                <span>{formatoEuro(item.gastado)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <h2>Gastos del mes</h2>
          <div className="expenses-list">
            {gastosMes.length === 0 && <p className="empty">No hay gastos en este mes.</p>}
            {gastosMes.map((g) => (
              <div key={g.id} className="expense-row">
                <div>
                  <strong>{g.concepto}</strong>
                  <p>{g.fecha} · {g.categoria} · {g.tipo} · Añadido por {g.creado_por}</p>
                </div>
                <div className="expense-actions">
                  <span>{formatoEuro(g.importe)}</span>
                  <button className="icon-btn" onClick={() => editExpense(g)}><Pencil size={16} /></button>
                  <button className="icon-btn danger" onClick={() => deleteExpense(g.id)}><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  if (!isSupabaseConfigured) return <SetupBox />;
  if (!session) return <AuthScreen onAuth={() => {}} />;
  return <AppShell session={session} />;
}
