import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserMultiFormatReader } from '@zxing/browser';
import JsBarcode from 'jsbarcode';
import './style.css';

const STORAGE_KEY = 'durga-garments-inventory-v1';
const navItems = [
  { id: 'Dashboard', icon: 'grid' },
  { id: 'Products', icon: 'box' },
  { id: 'Stock movements', icon: 'switch' },
  { id: 'Transactions', icon: 'clock' },
  { id: 'Reports', icon: 'chart' },
  { id: 'Settings', icon: 'settings' },
];
const stockOutReasons = ['Sale', 'Online Order', 'Offline Sale', 'Damage', 'Customer Return', 'Supplier Return', 'Personal Use', 'Stock Adjustment', 'Other'];
const defaults = {
  products: [],
  transactions: [],
  settings: { businessName: 'Durga Garments', lowStock: 5, allowNegative: false, currentUser: 'Admin' },
};

function readData() {
  try {
    const currentData = localStorage.getItem(STORAGE_KEY);
    const saved = JSON.parse(currentData || localStorage.getItem('inventoryCMS') || '{}');
    return {
      ...defaults,
      ...saved,
      products: Array.isArray(saved.products) ? saved.products.map((product, index) => ({
        ...product,
        id: product.id || uid(),
        sequence: Number(product.sequence) || index + 1,
        minimum: product.minimum ?? product.min ?? 5,
      })) : [],
      transactions: Array.isArray(saved.transactions) ? saved.transactions.map(transaction => ({
        ...transaction,
        quantity: transaction.quantity ?? transaction.qty ?? 0,
      })) : [],
      settings: { ...defaults.settings, ...(saved.settings || {}) },
    };
  } catch {
    return defaults;
  }
}

function uid() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function money(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value) || 0);
}

function dateLabel(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function getStock(product, transactions) {
  return transactions.reduce((total, transaction) => {
    if (transaction.productId !== product.id) return total;
    return total + (transaction.type === 'IN' ? Number(transaction.quantity) : -Number(transaction.quantity));
  }, Number(product.openingStock) || 0);
}

function makeSku(name, color, size, number, category) {
  const categoryCodes = { 'T-Shirts': 'TSH', Shirts: 'SHI', Jeans: 'JEA', Trousers: 'TRS', Dresses: 'DRS', 'Ethnic wear': 'ETH' };
  const colorCodes = { black: 'BLK', white: 'WHT', navy: 'NVY', blue: 'BLU', green: 'GRN', grey: 'GRY', gray: 'GRY', yellow: 'YLW', pink: 'PNK', brown: 'BRN', red: 'RED' };
  const productCode = categoryCodes[category] || (name.match(/[A-Za-z0-9]+/g) || ['PRD']).map(part => part.slice(0, 3)).join('').toUpperCase().slice(0, 6) || 'PRD';
  const normalizedColor = color.trim().toLowerCase();
  const colorCode = colorCodes[normalizedColor] || (color.match(/[A-Za-z0-9]+/g) || ['STD']).map(part => part.slice(0, 3)).join('').toUpperCase().slice(0, 3) || 'STD';
  const sizeCode = (size || 'OS').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 4) || 'OS';
  return `DG-${productCode}-${String(number).padStart(6, '0')}-${colorCode}-${sizeCode}`;
}

function Icon({ name, size = 18 }) {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    box: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 8 9 5 9-5M3 8v9l9 5 9-5V8M12 13v9" /></>,
    switch: <><path d="M7 7h14l-3-3M17 17H3l3 3" /><path d="M21 7v4M3 17v-4" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    chart: <><path d="M4 19V5M4 19h17" /><path d="m7 15 4-4 3 2 5-6" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7a8 8 0 0 1-1.6.9l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.6-.9l-1.7.7-1.4-2.4 1.4-1.1a7 7 0 0 1 0-1.9l-1.4-1.1 1.4-2.4 1.7.7a8 8 0 0 1 1.6-.9l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.6.9l1.7-.7 1.4 2.4-1.4 1.1a7 7 0 0 1-.1 1.9Z" transform="translate(-1 -1) scale(.96)" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
    scan: <><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16" /><path d="M8 9v6m4-6v6m4-6v6" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    download: <><path d="M12 3v12m-5-5 5 5 5-5M5 19h14" /></>,
    alert: <><path d="m12 3 10 18H2L12 3Z" /><path d="M12 9v5m0 3h.01" /></>,
    arrow: <><path d="M5 12h14m-6-6 6 6-6 6" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    image: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></>,
    bag: <><path d="M5 8h14l1 13H4L5 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.box}</svg>;
}

function App() {
  const [data, setData] = useState(readData);
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All categories');
  const [showProductForm, setShowProductForm] = useState(false);
  const [movement, setMovement] = useState(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanMessage, setScanMessage] = useState('');
  const [scanCode, setScanCode] = useState('');
  const [notice, setNotice] = useState('');
  const [range, setRange] = useState('7 days');
  const [productForm, setProductForm] = useState({
    name: '', description: '', category: 'T-Shirts', subcategory: '', brand: '', gender: 'Unisex', material: '',
    colors: '', sizes: '', purchase: '', selling: '', discount: '', gst: '5', minimum: '5', image: '',
  });
  const [moveForm, setMoveForm] = useState({ quantity: '1', reason: 'Sale', supplier: '', invoice: '', reference: '', warehouse: 'Main store', notes: '', purchasePrice: '' });
  const noticeTimer = useRef(null);
  const products = data.products;
  const transactions = data.transactions;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  useEffect(() => () => clearTimeout(noticeTimer.current), []);

  useEffect(() => {
    if (!scanOpen) return undefined;
    let controls;
    let cancelled = false;
    const reader = new BrowserMultiFormatReader();
    reader.decodeFromConstraints({ video: { facingMode: { ideal: 'environment' } } }, 'scanner-video', (result) => {
      if (!result || cancelled) return;
      const value = result.getText();
      cancelled = true;
      controls?.stop();
      setScanCode(value);
      setScanOpen(false);
      handleBarcode(value);
    }).then(value => {
      controls = value;
      if (cancelled) controls.stop();
    }).catch(error => {
      if (!cancelled) setScanMessage(`Camera could not start: ${error.message}`);
    });
    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, [scanOpen]);

  const productsWithStock = useMemo(() => products.map(product => ({ ...product, stock: getStock(product, transactions) })), [products, transactions]);
  const lowStock = productsWithStock.filter(product => product.stock <= Number(product.minimum ?? data.settings.lowStock));
  const stockValue = productsWithStock.reduce((sum, product) => sum + product.stock * Number(product.purchase || 0), 0);
  const categories = ['All categories', ...new Set(products.map(product => product.category).filter(Boolean))];
  const filteredProducts = productsWithStock.filter(product => {
    const term = query.trim().toLowerCase();
    const matchesQuery = !term || [product.name, product.sku, product.barcode, product.color, product.size, product.brand].some(value => String(value || '').toLowerCase().includes(term));
    return matchesQuery && (categoryFilter === 'All categories' || product.category === categoryFilter);
  });

  function showNotice(message) {
    setNotice(message);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(''), 3500);
  }

  function handleBarcode(value) {
    const match = products.find(product => product.barcode === value || String(product.sku || '').toLowerCase() === value.toLowerCase());
    if (match) {
      setScanMessage('');
      setActiveTab('Stock movements');
      setQuery(value);
      setMovement({ type: 'IN', productId: match.id });
      setMoveForm(form => ({ ...form, quantity: '1', purchasePrice: match.purchase || '' }));
      showNotice(`${match.name} · ${match.color} / ${match.size} found`);
    } else {
      setScanMessage(`No product found for “${value}”. You can add it to your catalog.`);
      setActiveTab('Products');
    }
  }

  function startScanner() {
    setScanMessage('');
    setScanCode('');
    setScanOpen(true);
  }

  function createProducts(event) {
    event.preventDefault();
    const colors = productForm.colors.split(',').map(value => value.trim()).filter(Boolean);
    const sizes = productForm.sizes.split(',').map(value => value.trim()).filter(Boolean);
    const colorOptions = colors.length ? colors : ['Default'];
    const sizeOptions = sizes.length ? sizes : ['One Size'];
    const combos = colorOptions.flatMap(color => sizeOptions.map(size => ({ color, size })));
    const lastNumber = products.reduce((max, product) => Math.max(max, Number(product.sequence) || 0), products.length);
    const now = new Date().toISOString();
    const newProducts = combos.map((variant, index) => {
      const sequence = lastNumber + index + 1;
      return {
        id: uid(), parentId: `${now}-${productForm.name.toLowerCase().replace(/\W+/g, '-')}`,
        sequence, name: productForm.name.trim(), description: productForm.description.trim(),
        category: productForm.category, subcategory: productForm.subcategory.trim(), brand: productForm.brand.trim(),
        gender: productForm.gender, material: productForm.material.trim(), color: variant.color, size: variant.size,
        sku: makeSku(productForm.name, variant.color, variant.size, sequence, productForm.category),
        barcode: String(Date.now()).slice(-8) + String(sequence).padStart(4, '0'),
        purchase: Number(productForm.purchase) || 0, selling: Number(productForm.selling) || 0,
        discount: Number(productForm.discount) || 0, gst: Number(productForm.gst) || 0,
        minimum: Number(productForm.minimum) || 0, image: productForm.image.trim(), status: 'Active', createdAt: now,
      };
    });
    setData(current => ({ ...current, products: [...newProducts, ...current.products] }));
    setProductForm({
      name: '', description: '', category: 'T-Shirts', subcategory: '', brand: '', gender: 'Unisex',
      material: '', colors: '', sizes: '', purchase: '', selling: '', discount: '', gst: '5', minimum: '5', image: '',
    });
    setShowProductForm(false);
    setQuery('');
    showNotice(`${newProducts.length} variant${newProducts.length === 1 ? '' : 's'} added to inventory`);
  }

  function openMovement(product, type) {
    setMovement({ type, productId: product.id });
    setMoveForm({
      quantity: '1', reason: type === 'IN' ? 'Purchase / Stock Received' : 'Sale', supplier: '',
      invoice: '', reference: '', warehouse: 'Main store', notes: '', purchasePrice: product.purchase || '',
    });
  }

  function saveMovement(event) {
    event.preventDefault();
    const product = products.find(item => item.id === movement?.productId);
    if (!product) return;
    const quantity = Number(moveForm.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      showNotice('Enter a whole-number quantity greater than zero.');
      return;
    }
    const currentStock = getStock(product, transactions);
    if (movement.type === 'OUT' && !data.settings.allowNegative && quantity > currentStock) {
      showNotice(`Only ${currentStock} unit${currentStock === 1 ? '' : 's'} available. Stock cannot go negative.`);
      return;
    }
    const transaction = {
      id: uid(), productId: product.id, type: movement.type, quantity,
      reason: moveForm.reason, supplier: moveForm.supplier.trim(), invoice: moveForm.invoice.trim(),
      reference: moveForm.reference.trim(), warehouse: moveForm.warehouse.trim(), notes: moveForm.notes.trim(),
      purchasePrice: Number(moveForm.purchasePrice) || Number(product.purchase) || 0,
      date: new Date().toISOString(), user: data.settings.currentUser || 'Admin',
    };
    setData(current => ({ ...current, transactions: [transaction, ...current.transactions] }));
    setMovement(null);
    showNotice(`Stock ${movement.type === 'IN' ? 'IN' : 'OUT'} recorded · ${quantity} units`);
  }

  function exportCSV() {
    const columns = ['Product', 'Category', 'Brand', 'Color', 'Size', 'SKU', 'Barcode', 'Stock', 'Minimum Stock', 'Purchase Price', 'Selling Price', 'Discount Price', 'GST %'];
    const rows = productsWithStock.map(product => [
      product.name, product.category, product.brand, product.color, product.size, product.sku,
      product.barcode, product.stock, product.minimum, product.purchase, product.selling, product.discount, product.gst,
    ]);
    const csv = [columns, ...rows].map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    link.download = 'durga-garments-inventory.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function importCSV(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      const lines = text.split(/\r?\n/).filter(Boolean);
      if (lines.length < 2) {
        showNotice('The CSV is empty or has no product rows.');
        return;
      }
      const headers = parseCSVLine(lines[0]).map(value => value.trim().toLowerCase());
      const field = (...names) => names.map(name => headers.indexOf(name)).find(index => index >= 0);
      const nameIndex = field('product', 'name', 'product name');
      if (nameIndex === undefined) {
        showNotice('CSV needs a Product or Name column.');
        return;
      }
      let sequence = products.reduce((max, product) => Math.max(max, Number(product.sequence) || 0), products.length);
      const imported = [];
      const openingTransactions = [];
      lines.slice(1).forEach((line, index) => {
        const values = parseCSVLine(line);
        if (!values[nameIndex]?.trim()) return;
        const id = uid();
        sequence += 1;
        const get = (...names) => {
          const i = field(...names);
          return i === undefined ? '' : values[i] || '';
        };
        const product = {
          id, sequence, parentId: id, name: get('product', 'name', 'product name').trim(),
          category: get('category') || 'Other', brand: get('brand'), color: get('color'),
          size: get('size'), sku: get('sku') || makeSku(get('product', 'name', 'product name'), get('color'), get('size'), sequence, get('category')),
          barcode: get('barcode') || `${Date.now().toString().slice(-8)}${String(sequence).padStart(4, '0')}`,
          purchase: Number(get('purchase price', 'purchase')) || 0, selling: Number(get('selling price', 'selling')) || 0,
          discount: Number(get('discount price', 'discount')) || 0, gst: Number(get('gst %', 'gst')) || 0,
          minimum: Number(get('minimum stock', 'minimum')) || Number(data.settings.lowStock) || 0,
          description: '', subcategory: '', gender: 'Unisex', material: '', image: '', status: 'Active',
        };
        imported.push(product);
        const stock = Number(get('stock', 'opening stock')) || 0;
        if (stock > 0) openingTransactions.push({
          id: uid(), productId: id, type: 'IN', quantity: stock, reason: 'CSV opening balance',
          supplier: '', invoice: '', reference: '', warehouse: 'Main store', notes: 'Imported from CSV',
          purchasePrice: product.purchase, date: new Date().toISOString(), user: data.settings.currentUser || 'Admin',
        });
      });
      setData(current => ({ ...current, products: [...imported, ...current.products], transactions: [...openingTransactions, ...current.transactions] }));
      showNotice(`${imported.length} product variants imported`);
      event.target.value = '';
    };
    reader.onerror = () => showNotice('Could not read the selected CSV file.');
    reader.readAsText(file);
  }

  function printBarcode(product) {
    const printWindow = window.open('', '_blank', 'width=520,height=420');
    if (!printWindow) {
      showNotice('Allow pop-ups to print barcode labels.');
      return;
    }
    const barcode = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    try {
      JsBarcode(barcode, product.barcode, { format: 'CODE128', displayValue: false, height: 54, margin: 0 });
    } catch (error) {
      printWindow.close();
      showNotice(`Could not create barcode label: ${error.message}`);
      return;
    }
    printWindow.document.write(`<!doctype html><html><head><title>Barcode label</title><style>body{font-family:Arial,sans-serif;display:grid;place-items:center;min-height:90vh}.label{border:1px dashed #aaa;padding:18px;text-align:center;width:300px}.label strong{font-size:14px}.variant{margin-top:4px;color:#555;font-size:12px}svg{display:block;width:100%;height:auto;margin:12px auto}.code{font-size:12px}.sku{margin-top:5px;font-size:10px;color:#555}@media print{body{min-height:0}}</style></head><body><div class="label"><strong>${escapeHTML(product.name)}</strong><div class="variant">${escapeHTML(`${product.color || ''} / ${product.size || ''}`)}</div>${barcode.outerHTML}<div class="code">${escapeHTML(product.barcode)}</div><div class="sku">${escapeHTML(product.sku)}</div></div><script>window.onload=()=>window.print();</script></body></html>`);
    printWindow.document.close();
  }

  const title = activeTab === 'Stock movements' ? 'Stock movements' : activeTab;
  const searchBar = <div className="search-control"><Icon name="search" /><input value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (activeTab === 'Stock movements' && event.key === 'Enter' && query.trim()) handleBarcode(query.trim()); }} placeholder="Search products, SKU or barcode" aria-label="Search products, SKU or barcode" /></div>;

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#" onClick={event => { event.preventDefault(); setActiveTab('Dashboard'); }}>
        <span className="brand-mark">DG</span><span className="brand-copy"><strong>Durga Garments</strong><small>INVENTORY MANAGEMENT</small></span>
      </a>
      <div className="nav-caption">WORKSPACE</div>
      <nav className="main-nav" aria-label="Main navigation">
        {navItems.map(item => <button key={item.id} className={`nav-item ${activeTab === item.id ? 'selected' : ''}`} onClick={() => { setActiveTab(item.id); setQuery(''); }}>
          <Icon name={item.icon} size={19} /><span>{item.id}</span>{item.id === 'Products' && products.length > 0 && <span className="nav-count">{products.length}</span>}
        </button>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="help-card"><span className="help-icon"><Icon name="bag" size={17} /></span><strong>Stock, in sync.</strong><p>Every movement updates your central inventory.</p><button onClick={() => setActiveTab('Stock movements')}>Record movement <Icon name="arrow" size={14} /></button></div>
        <div className="user-chip"><span className="avatar">{(data.settings.currentUser || 'A').slice(0, 1).toUpperCase()}</span><span><strong>{data.settings.currentUser || 'Admin'}</strong><small>Workspace user</small></span><button aria-label="Open settings" onClick={() => setActiveTab('Settings')}><Icon name="settings" size={17} /></button></div>
      </div>
    </aside>

    <main className="main-content">
      <header className="topbar">
        <div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><strong>{title}</strong></div>
        <div className="topbar-actions"><span className="live-status"><i /> Inventory up to date</span><button className="button button-outline scan-action" onClick={startScanner}><Icon name="scan" size={17} /><span>Scan barcode</span></button></div>
      </header>
      <div className="page-content">
        {activeTab === 'Dashboard' && <Dashboard
          products={productsWithStock} transactions={transactions} lowStock={lowStock}
          stockValue={stockValue} range={range} setRange={setRange} onNavigate={setActiveTab}
          onExport={exportCSV} onNewProduct={() => setShowProductForm(true)}
        />}
        {activeTab === 'Products' && <section>
          <PageHeading eyebrow="CATALOG" title="Products & variants" description="Keep every style, color and size organized in one place.">
            <button className="button button-primary" onClick={() => setShowProductForm(true)}><Icon name="plus" />Add product</button>
          </PageHeading>
          {scanMessage && <div className="inline-alert"><Icon name="alert" /><span>{scanMessage}</span><button className="text-button" onClick={() => setShowProductForm(true)}>Create product</button><button className="icon-button" onClick={() => setScanMessage('')} aria-label="Dismiss"><Icon name="close" /></button></div>}
          <div className="panel catalog-panel">
            <div className="table-toolbar">{searchBar}<select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)} aria-label="Filter by category">{categories.map(category => <option key={category}>{category}</option>)}</select><span className="result-count">{filteredProducts.length} variants</span></div>
            <ProductTable products={filteredProducts} onStock={openMovement} onPrint={printBarcode} />
          </div>
        </section>}
        {activeTab === 'Stock movements' && <StockMovements products={filteredProducts} allProducts={productsWithStock} query={query} setQuery={setQuery} searchBar={searchBar} onStock={openMovement} onScan={startScanner} onCreate={() => setShowProductForm(true)} scanMessage={scanMessage} />}
        {activeTab === 'Transactions' && <Transactions transactions={transactions} products={products} query={query} searchBar={searchBar} onExport={exportCSV} />}
        {activeTab === 'Reports' && <Reports products={productsWithStock} transactions={transactions} lowStock={lowStock} onExport={exportCSV} />}
        {activeTab === 'Settings' && <Settings data={data} setData={setData} onImport={importCSV} onExport={exportCSV} />}
      </div>
    </main>

    {scanOpen && <div className="overlay" role="dialog" aria-modal="true" aria-label="Scan a barcode">
      <div className="modal scanner-modal">
        <div className="modal-heading"><div><span className="eyebrow">BARCODE SCANNER</span><h2>Scan a product</h2></div><button className="icon-button" onClick={() => setScanOpen(false)} aria-label="Close scanner"><Icon name="close" /></button></div>
        <div className="camera-frame"><video id="scanner-video" muted playsInline /><span className="scan-line" /></div>
        <p className="modal-hint">Point your camera at a product barcode. You can also use a USB scanner in the barcode field.</p>
        <div className="scanner-manual"><input autoFocus value={scanCode} onChange={event => setScanCode(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && scanCode.trim()) { setScanOpen(false); handleBarcode(scanCode.trim()); } }} placeholder="Type or scan barcode, then press Enter" /><button type="button" className="button button-primary" onClick={() => { if (scanCode.trim()) { setScanOpen(false); handleBarcode(scanCode.trim()); } }}>Find</button></div>
        {scanMessage && <p className="error-note">{scanMessage}</p>}
      </div>
    </div>}

    {showProductForm && <div className="overlay" role="dialog" aria-modal="true" aria-label="Add product variants">
      <form className="modal product-modal" onSubmit={createProducts}>
        <div className="modal-heading"><div><span className="eyebrow">PRODUCT CATALOG</span><h2>Add product & variants</h2><p>Create a style and its color/size variants together.</p></div><button type="button" className="icon-button" onClick={() => setShowProductForm(false)} aria-label="Close form"><Icon name="close" /></button></div>
        <div className="form-grid">
          <Field label="Product name" required><input required value={productForm.name} onChange={event => setProductForm({ ...productForm, name: event.target.value })} placeholder="e.g. Premium Cotton T-Shirt" /></Field>
          <Field label="Category"><select value={productForm.category} onChange={event => setProductForm({ ...productForm, category: event.target.value })}>{['T-Shirts', 'Shirts', 'Jeans', 'Trousers', 'Dresses', 'Ethnic wear', 'Other'].map(option => <option key={option}>{option}</option>)}</select></Field>
          <Field label="Brand"><input value={productForm.brand} onChange={event => setProductForm({ ...productForm, brand: event.target.value })} placeholder="Brand name" /></Field>
          <Field label="Subcategory"><input value={productForm.subcategory} onChange={event => setProductForm({ ...productForm, subcategory: event.target.value })} placeholder="e.g. Casual wear" /></Field>
          <Field label="Gender"><select value={productForm.gender} onChange={event => setProductForm({ ...productForm, gender: event.target.value })}>{['Unisex', 'Women', 'Men', 'Boys', 'Girls', 'Kids'].map(option => <option key={option}>{option}</option>)}</select></Field>
          <Field label="Fabric / material"><input value={productForm.material} onChange={event => setProductForm({ ...productForm, material: event.target.value })} placeholder="e.g. 100% cotton" /></Field>
          <Field label="Colors" hint="Separate with commas"><input value={productForm.colors} onChange={event => setProductForm({ ...productForm, colors: event.target.value })} placeholder="Black, White, Navy" /></Field>
          <Field label="Sizes" hint="Separate with commas"><input value={productForm.sizes} onChange={event => setProductForm({ ...productForm, sizes: event.target.value })} placeholder="S, M, L, XL" /></Field>
          <Field label="Purchase price (₹)"><input type="number" min="0" step="0.01" value={productForm.purchase} onChange={event => setProductForm({ ...productForm, purchase: event.target.value })} placeholder="0.00" /></Field>
          <Field label="Selling price (₹)"><input type="number" min="0" step="0.01" value={productForm.selling} onChange={event => setProductForm({ ...productForm, selling: event.target.value })} placeholder="0.00" /></Field>
          <Field label="Discount price (₹)"><input type="number" min="0" step="0.01" value={productForm.discount} onChange={event => setProductForm({ ...productForm, discount: event.target.value })} placeholder="Optional" /></Field>
          <Field label="GST (%)"><input type="number" min="0" max="100" step="0.01" value={productForm.gst} onChange={event => setProductForm({ ...productForm, gst: event.target.value })} /></Field>
          <Field label="Minimum stock"><input type="number" min="0" step="1" value={productForm.minimum} onChange={event => setProductForm({ ...productForm, minimum: event.target.value })} /></Field>
          <Field label="Image URL"><input type="url" value={productForm.image} onChange={event => setProductForm({ ...productForm, image: event.target.value })} placeholder="https://…" /></Field>
          <Field label="Description" className="full-field"><textarea rows="2" value={productForm.description} onChange={event => setProductForm({ ...productForm, description: event.target.value })} placeholder="Product details" /></Field>
        </div>
        <div className="variant-preview"><Icon name="box" size={16} /><span>This creates <strong>{Math.max(1, productForm.colors.split(',').filter(value => value.trim()).length) * Math.max(1, productForm.sizes.split(',').filter(value => value.trim()).length)} variants</strong>, each with a unique SKU and barcode.</span></div>
        <div className="modal-footer"><button type="button" className="button button-quiet" onClick={() => setShowProductForm(false)}>Cancel</button><button className="button button-primary" type="submit"><Icon name="plus" />Create variants</button></div>
      </form>
    </div>}

    {movement && <div className="overlay" role="dialog" aria-modal="true" aria-label={`Record stock ${movement.type}`}>
      <form className="modal movement-modal" onSubmit={saveMovement}>
        <div className="modal-heading"><div><span className="eyebrow">{movement.type === 'IN' ? 'INCOMING INVENTORY' : 'OUTGOING INVENTORY'}</span><h2>Record stock {movement.type}</h2></div><button type="button" className="icon-button" onClick={() => setMovement(null)} aria-label="Close form"><Icon name="close" /></button></div>
        <div className="selected-product"><div className="product-placeholder"><Icon name="image" /></div><div><strong>{products.find(product => product.id === movement.productId)?.name}</strong><small>{products.find(product => product.id === movement.productId)?.color} / {products.find(product => product.id === movement.productId)?.size} · {products.find(product => product.id === movement.productId)?.sku}</small></div><span className="stock-pill">{getStock(products.find(product => product.id === movement.productId) || {}, transactions)} in stock</span></div>
        <div className="form-grid">
          <Field label="Quantity" required><input required type="number" min="1" step="1" value={moveForm.quantity} onChange={event => setMoveForm({ ...moveForm, quantity: event.target.value })} /></Field>
          {movement.type === 'OUT' ? <Field label="Reason" required><select value={moveForm.reason} onChange={event => setMoveForm({ ...moveForm, reason: event.target.value })}>{stockOutReasons.map(reason => <option key={reason}>{reason}</option>)}</select></Field> : <Field label="Purchase price (₹)"><input type="number" min="0" step="0.01" value={moveForm.purchasePrice} onChange={event => setMoveForm({ ...moveForm, purchasePrice: event.target.value })} /></Field>}
          {movement.type === 'IN' ? <Field label="Supplier"><input value={moveForm.supplier} onChange={event => setMoveForm({ ...moveForm, supplier: event.target.value })} placeholder="Supplier name" /></Field> : <Field label="Reference / order no."><input value={moveForm.reference} onChange={event => setMoveForm({ ...moveForm, reference: event.target.value })} placeholder="Order or reference" /></Field>}
          <Field label="Invoice number"><input value={moveForm.invoice} onChange={event => setMoveForm({ ...moveForm, invoice: event.target.value })} placeholder="Optional" /></Field>
          <Field label="Location / warehouse"><input value={moveForm.warehouse} onChange={event => setMoveForm({ ...moveForm, warehouse: event.target.value })} /></Field>
          <Field label="Notes" className="full-field"><textarea rows="2" value={moveForm.notes} onChange={event => setMoveForm({ ...moveForm, notes: event.target.value })} placeholder="Add a note for the audit trail" /></Field>
        </div>
        <div className="audit-hint"><Icon name="clock" size={16} />Saved with date, time and user: <strong>{data.settings.currentUser || 'Admin'}</strong></div>
        <div className="modal-footer"><button type="button" className="button button-quiet" onClick={() => setMovement(null)}>Cancel</button><button className={`button ${movement.type === 'IN' ? 'button-primary' : 'button-danger'}`} type="submit">Save stock {movement.type}</button></div>
      </form>
    </div>}

    {notice && <div className="toast" role="status">{notice}</div>}
  </div>;
}

function parseCSVLine(line) {
  const values = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const character = line[i];
    if (character === '"' && line[i + 1] === '"' && quoted) { value += '"'; i += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === ',' && !quoted) { values.push(value); value = ''; }
    else value += character;
  }
  values.push(value);
  return values;
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function PageHeading({ eyebrow, title, description, children }) {
  return <div className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{children && <div className="heading-actions">{children}</div>}</div>;
}

function Dashboard({ products, transactions, lowStock, stockValue, range, setRange, onNavigate, onExport, onNewProduct }) {
  const units = products.reduce((sum, product) => sum + product.stock, 0);
  const recent = transactions.slice(0, 5);
  const dayCount = range === '30 days' ? 30 : 7;
  const chartDays = Array.from({ length: dayCount }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (dayCount - 1 - index));
    const key = date.toLocaleDateString('en-CA');
    const count = transactions.filter(transaction => transaction.date?.slice(0, 10) === key).reduce((sum, transaction) => sum + Number(transaction.quantity) * (transaction.type === 'IN' ? 1 : -1), 0);
    return { label: dayCount === 30 ? (index % 5 === 0 || index === dayCount - 1 ? String(date.getDate()) : '') : date.toLocaleDateString('en', { weekday: 'short' }), count };
  });
  const max = Math.max(1, ...chartDays.map(day => Math.abs(day.count)));
  const movementProducts = [...products].sort((a, b) => b.stock - a.stock).slice(0, 5);
  return <section>
    <PageHeading eyebrow="OVERVIEW" title="Good to see you." description="Here’s what’s happening with your inventory today.">
      <button className="button button-outline" onClick={onExport}><Icon name="download" />Export</button><button className="button button-primary" onClick={onNewProduct}><Icon name="plus" />Add product</button>
    </PageHeading>
    <div className="stats-grid">
      <StatCard label="Total products" value={products.length.toLocaleString('en-IN')} icon="box" note="Active variants in catalog" tone="blue" />
      <StatCard label="Units in stock" value={units.toLocaleString('en-IN')} icon="bag" note="Across all variants" tone="green" />
      <StatCard label="Low stock alerts" value={lowStock.length.toLocaleString('en-IN')} icon="alert" note={lowStock.length ? 'Needs your attention' : 'All stock levels look good'} tone="amber" />
      <StatCard label="Inventory value" value={money(stockValue)} icon="chart" note="Based on purchase price" tone="violet" />
    </div>
    <div className="dashboard-grid">
      <div className="panel chart-panel">
        <div className="panel-heading"><div><h2>Stock movement</h2><p>Net units moved over the last 7 days</p></div><select value={range} onChange={event => setRange(event.target.value)} aria-label="Chart range"><option>7 days</option><option>30 days</option></select></div>
        <div className="chart-area"><div className="chart-y-labels"><span>More</span><span>0</span><span>Less</span></div><div className="bar-chart" style={{ gridTemplateColumns: `repeat(${chartDays.length}, minmax(0, 1fr))`, gap: chartDays.length > 10 ? '3px' : '9px' }}>{chartDays.map((day, index) => <div className="bar-column" key={`${day.label}-${index}`}><div className="bar-track"><span className={`bar ${day.count < 0 ? 'bar-negative' : ''}`} style={{ height: `${Math.max(5, Math.abs(day.count) / max * 100)}%` }} title={`${day.count} units`} /></div><small>{day.label}</small></div>)}</div></div>
        <div className="chart-legend"><span><i className="legend-dot" />Net stock movement</span><span>↑ stock in &nbsp; ↓ stock out</span></div>
      </div>
      <div className="panel low-stock-panel">
        <div className="panel-heading"><div><h2>Low stock</h2><p>At or below minimum quantity</p></div><button className="link-button" onClick={() => onNavigate('Products')}>View all <Icon name="arrow" size={14} /></button></div>
        {lowStock.length ? <div className="compact-list">{lowStock.slice(0, 5).map(product => <div className="compact-row" key={product.id}><div className="mini-product-icon"><Icon name="box" size={16} /></div><div className="compact-product"><strong>{product.name}</strong><small>{product.color} / {product.size} · {product.sku}</small></div><span className="low-quantity">{product.stock} left</span></div>)}</div> : <EmptyState title="You're well stocked" text="No variants are below their minimum level." />}
      </div>
      <div className="panel inventory-panel">
        <div className="panel-heading"><div><h2>Stock on hand</h2><p>Your highest quantity variants</p></div><button className="link-button" onClick={() => onNavigate('Products')}>Catalog <Icon name="arrow" size={14} /></button></div>
        {movementProducts.length ? <div className="stock-bars">{movementProducts.map(product => <div className="stock-bar-row" key={product.id}><div className="stock-bar-label"><span>{product.name}<small>{product.color} / {product.size}</small></span><strong>{product.stock}</strong></div><div className="stock-track"><i style={{ width: `${Math.max(2, product.stock / Math.max(1, movementProducts[0].stock) * 100)}%` }} /></div></div>)}</div> : <EmptyState title="No inventory yet" text="Add a product to get started." />}
      </div>
      <div className="panel recent-panel">
        <div className="panel-heading"><div><h2>Recent activity</h2><p>Your latest stock transactions</p></div><button className="link-button" onClick={() => onNavigate('Transactions')}>All activity <Icon name="arrow" size={14} /></button></div>
        {recent.length ? <div className="activity-list">{recent.map(transaction => {
          const product = products.find(item => item.id === transaction.productId);
          return <div className="activity-row" key={transaction.id}><span className={`activity-icon ${transaction.type === 'IN' ? 'activity-in' : 'activity-out'}`}>{transaction.type === 'IN' ? '+' : '−'}</span><div className="activity-description"><strong>{product?.name || 'Removed product'}</strong><small>{transaction.reason} · {dateLabel(transaction.date)}</small></div><span className={`movement-qty ${transaction.type === 'IN' ? 'qty-in' : 'qty-out'}`}>{transaction.type === 'IN' ? '+' : '−'}{transaction.quantity}</span></div>;
        })}</div> : <EmptyState title="No transactions yet" text="Your stock activity will appear here." />}
      </div>
    </div>
  </section>;
}

function StatCard({ label, value, icon, note, tone }) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}><Icon name={icon} size={19} /></div><span className="stat-label">{label}</span><strong className="stat-value">{value}</strong><small>{note}</small></div>;
}

function EmptyState({ title, text }) {
  return <div className="empty-state"><span className="empty-icon"><Icon name="box" size={21} /></span><strong>{title}</strong><p>{text}</p></div>;
}

function Field({ label, required, hint, className = '', children }) {
  return <label className={`field ${className}`}><span>{label}{required && <i> *</i>}{hint && <small>{hint}</small>}</span>{children}</label>;
}

function ProductTable({ products, onStock, onPrint }) {
  if (!products.length) return <EmptyState title="No products found" text="Try another search or add your first product variant." />;
  return <div className="table-scroll"><table className="data-table"><thead><tr><th>PRODUCT</th><th>SKU / BARCODE</th><th>PRICE</th><th>IN STOCK</th><th>STATUS</th><th><span className="visually-hidden">Actions</span></th></tr></thead><tbody>{products.map(product => <tr key={product.id}>
    <td><div className="table-product"><span className="table-product-image">{product.image ? <img src={product.image} alt="" /> : <Icon name="image" size={18} />}</span><span><strong>{product.name}</strong><small>{product.brand || product.category} · {product.color || 'Default'} / {product.size || 'One Size'}</small></span></div></td>
    <td><strong className="sku-text">{product.sku}</strong><small className="cell-subtext">{product.barcode}</small></td>
    <td><strong>{money(product.selling)}</strong><small className="cell-subtext">GST {product.gst || 0}%</small></td>
    <td><span className={`stock-label ${product.stock <= Number(product.minimum || 0) ? 'stock-low' : ''}`}>{product.stock}<small>min {product.minimum || 0}</small></span></td>
    <td><span className="status-badge"><i />Active</span></td>
    <td><div className="row-actions"><button title="Stock IN" aria-label={`Stock IN ${product.name}`} onClick={() => onStock(product, 'IN')}>+</button><button title="Stock OUT" aria-label={`Stock OUT ${product.name}`} onClick={() => onStock(product, 'OUT')}>−</button><button title="Print label" aria-label={`Print barcode label for ${product.name}`} onClick={() => onPrint(product)}><Icon name="download" size={15} /></button></div></td>
  </tr>)}</tbody></table></div>;
}

function StockMovements({ products, allProducts, query, setQuery, searchBar, onStock, onScan, onCreate, scanMessage }) {
  const selected = allProducts.find(product => product.barcode === query || product.sku.toLowerCase() === query.toLowerCase());
  return <section>
    <PageHeading eyebrow="INVENTORY CONTROL" title="Stock movements" description="Scan or select a variant to record incoming or outgoing stock.">
      <button className="button button-outline" onClick={onScan}><Icon name="scan" />Scan barcode</button>
    </PageHeading>
    <div className="movement-banner"><div className="movement-banner-icon"><Icon name="switch" size={21} /></div><div><strong>One central inventory. Every movement accounted for.</strong><p>Stock changes are recorded with a timestamp and user for a complete audit trail.</p></div><div className="movement-totals"><span>Variants <strong>{allProducts.length}</strong></span><span>Units on hand <strong>{allProducts.reduce((sum, product) => sum + product.stock, 0)}</strong></span></div></div>
    {scanMessage && <div className="inline-alert"><Icon name="alert" /><span>{scanMessage}</span><button className="text-button" onClick={onCreate}>Create product</button></div>}
    <div className="catalog-toolbar">{searchBar}<span className="result-count">{products.length} matching variants</span></div>
    {selected && <div className="found-banner"><span><Icon name="scan" />Barcode matched: <strong>{selected.name}</strong> · {selected.color} / {selected.size}</span><button className="button button-primary button-small" onClick={() => onStock(selected, 'IN')}>Record stock IN</button><button className="button button-danger button-small" onClick={() => onStock(selected, 'OUT')}>Record stock OUT</button></div>}
    <div className="movement-cards">{products.map(product => <div className="movement-card" key={product.id}>
      <div className="movement-card-top"><span className="product-placeholder"><Icon name="image" /></span><span className={`stock-badge ${product.stock <= Number(product.minimum || 0) ? 'stock-badge-low' : ''}`}>{product.stock} in stock</span></div>
      <h3>{product.name}</h3><p>{product.brand || product.category} · {product.color || 'Default'} / {product.size || 'One Size'}</p><div className="movement-sku">{product.sku}</div>
      <div className="movement-card-actions"><button className="button button-in" onClick={() => onStock(product, 'IN')}><Icon name="plus" size={16} />Stock IN</button><button className="button button-out" onClick={() => onStock(product, 'OUT')}>Stock OUT</button></div>
    </div>)}</div>
    {!products.length && <div className="panel empty-panel"><EmptyState title={query ? 'No matching variants' : 'No products to move'} text={query ? 'Check the barcode or search term and try again.' : 'Add a product variant first, then record its stock.'} />{query && <button className="button button-primary" onClick={onCreate}>Create product</button>}</div>}
  </section>;
}

function Transactions({ transactions, products, query, searchBar, onExport }) {
  const filtered = transactions.filter(transaction => {
    const product = products.find(item => item.id === transaction.productId);
    const text = `${product?.name || ''} ${product?.sku || ''} ${transaction.reason} ${transaction.reference} ${transaction.user}`.toLowerCase();
    return !query || text.includes(query.toLowerCase());
  });
  return <section><PageHeading eyebrow="AUDIT TRAIL" title="Transactions" description="A complete, chronological record of every stock movement."><button className="button button-outline" onClick={onExport}><Icon name="download" />Export catalog</button></PageHeading>
    <div className="panel transaction-panel"><div className="table-toolbar">{searchBar}<span className="result-count">{filtered.length} transactions</span></div>
      {filtered.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>DATE & TIME</th><th>PRODUCT</th><th>MOVEMENT</th><th>REASON / REFERENCE</th><th>LOCATION</th><th>USER</th></tr></thead><tbody>{filtered.map(transaction => {
        const product = products.find(item => item.id === transaction.productId);
        return <tr key={transaction.id}><td>{dateLabel(transaction.date)}</td><td><div className="transaction-product"><strong>{product?.name || 'Removed product'}</strong><small>{product?.sku || '—'} · {product?.color} / {product?.size}</small></div></td><td><span className={`movement-tag ${transaction.type === 'IN' ? 'tag-in' : 'tag-out'}`}>{transaction.type === 'IN' ? '+' : '−'}{transaction.quantity} · {transaction.type}</span></td><td><strong>{transaction.reason}</strong><small className="cell-subtext">{transaction.reference || transaction.invoice || transaction.supplier || transaction.notes || '—'}</small></td><td>{transaction.warehouse || '—'}</td><td>{transaction.user || 'Admin'}</td></tr>;
      })}</tbody></table></div> : <EmptyState title="No transactions found" text="Stock movements will appear here as they are recorded." />}
    </div>
  </section>;
}

function Reports({ products, transactions, lowStock, onExport }) {
  const inUnits = transactions.filter(transaction => transaction.type === 'IN').reduce((sum, transaction) => sum + Number(transaction.quantity), 0);
  const outUnits = transactions.filter(transaction => transaction.type === 'OUT').reduce((sum, transaction) => sum + Number(transaction.quantity), 0);
  const totalStock = products.reduce((sum, product) => sum + product.stock, 0);
  const categoryRows = [...new Set(products.map(product => product.category || 'Other'))].map(category => {
    const items = products.filter(product => (product.category || 'Other') === category);
    return { category, count: items.length, stock: items.reduce((sum, product) => sum + product.stock, 0), value: items.reduce((sum, product) => sum + product.stock * Number(product.purchase || 0), 0) };
  }).sort((a, b) => b.stock - a.stock);
  return <section><PageHeading eyebrow="BUSINESS INSIGHTS" title="Reports" description="Understand stock levels, movement and inventory value."><button className="button button-primary" onClick={onExport}><Icon name="download" />Export CSV</button></PageHeading>
    <div className="report-stats"><StatCard label="Stock received" value={inUnits.toLocaleString('en-IN')} icon="switch" note="Units moved in" tone="green" /><StatCard label="Stock issued" value={outUnits.toLocaleString('en-IN')} icon="bag" note="Units moved out" tone="blue" /><StatCard label="Current stock" value={totalStock.toLocaleString('en-IN')} icon="box" note="Units on hand" tone="violet" /><StatCard label="Variants to replenish" value={lowStock.length} icon="alert" note="At or below minimum" tone="amber" /></div>
    <div className="panel report-panel"><div className="panel-heading"><div><h2>Category summary</h2><p>Inventory position by product category</p></div></div>
      {categoryRows.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>CATEGORY</th><th>VARIANTS</th><th>UNITS IN STOCK</th><th>STOCK VALUE</th></tr></thead><tbody>{categoryRows.map(row => <tr key={row.category}><td><strong>{row.category}</strong></td><td>{row.count}</td><td>{row.stock.toLocaleString('en-IN')}</td><td>{money(row.value)}</td></tr>)}</tbody></table></div> : <EmptyState title="Reports are ready when you are" text="Add products and record stock movements to see your business insights." />}
    </div>
    <div className="report-note"><Icon name="alert" size={17} /><span>GST rates are stored per product for reporting reference. Validate tax treatment with your accountant before using for statutory filings.</span></div>
  </section>;
}

function Settings({ data, setData, onImport, onExport }) {
  const updateSetting = (key, value) => setData(current => ({ ...current, settings: { ...current.settings, [key]: value } }));
  return <section><PageHeading eyebrow="PREFERENCES" title="Settings" description="Configure your workspace and inventory defaults." />
    <div className="settings-layout">
      <div className="panel settings-panel"><div className="settings-title"><span className="settings-icon"><Icon name="settings" /></span><div><h2>Business settings</h2><p>Personalize your inventory workspace.</p></div></div>
        <div className="settings-fields"><Field label="Business name"><input value={data.settings.businessName} onChange={event => updateSetting('businessName', event.target.value)} /></Field><Field label="Current user"><input value={data.settings.currentUser} onChange={event => updateSetting('currentUser', event.target.value)} placeholder="Admin" /></Field><Field label="Default low-stock threshold" hint="Used when a product has no custom minimum"><input type="number" min="0" value={data.settings.lowStock} onChange={event => updateSetting('lowStock', Number(event.target.value))} /></Field></div>
        <div className="setting-toggle"><span><strong>Allow negative inventory</strong><small>Permit stock OUT transactions even when quantity on hand is insufficient.</small></span><input type="checkbox" checked={Boolean(data.settings.allowNegative)} onChange={event => updateSetting('allowNegative', event.target.checked)} /></div>
      </div>
      <div className="panel settings-panel"><div className="settings-title"><span className="settings-icon settings-icon-blue"><Icon name="download" /></span><div><h2>Import & export</h2><p>Move product data in and out of your workspace.</p></div></div>
        <div className="data-actions"><div><strong>Export catalog</strong><small>Download products, barcodes, prices, GST and current stock as CSV.</small></div><button className="button button-outline" onClick={onExport}><Icon name="download" />Export CSV</button></div>
        <div className="data-actions"><div><strong>Import products</strong><small>CSV columns: Product, SKU, Barcode, Color, Size, Stock, prices and GST.</small></div><label className="button button-outline file-button">Choose CSV<input type="file" accept=".csv,text/csv" onChange={onImport} /></label></div>
      </div>
      <div className="panel data-notice"><span className="notice-mark">i</span><div><strong>About your data</strong><p>This starter stores its data in this browser only. It does not provide multi-user accounts, role-based access, or cross-device synchronization. For shared production use, connect a secure server and central database before onboarding staff.</p></div></div>
    </div>
  </section>;
}

createRoot(document.getElementById('root')).render(<App />);
