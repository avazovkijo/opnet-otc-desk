import { useEffect, useMemo, useState } from 'react';
import { useWalletConnect } from '@btc-vision/walletconnect';
import {
  ArrowRightLeft,
  Clock3,
  Copy,
  ExternalLink,
  Filter,
  Gauge,
  ReceiptText,
  Search,
  ShieldCheck,
  Users,
  Wallet,
} from 'lucide-react';

type RuntimeState = 'idle' | 'staged' | 'executing' | 'invalid';
type Side = 'buy' | 'sell';

type QuoteRow = {
  id: number;
  pair: string;
  side: Side;
  size: number;
  spread: number;
  settlement: 'firm' | 'indicative' | 'expired';
};

const STORAGE_KEY = 'otc_desk_contract_address';
const DEFAULT_CONTRACT = (import.meta.env.VITE_CONTRACT_ADDRESS || '').trim();

const QUOTES: QuoteRow[] = [
  { id: 104, pair: 'PIL/tBTC', side: 'buy', size: 120_000, spread: 18, settlement: 'firm' },
  { id: 105, pair: 'MOTO/PIL', side: 'sell', size: 38, spread: 33, settlement: 'indicative' },
  { id: 106, pair: 'PIL/tBTC', side: 'sell', size: 84_000, spread: 22, settlement: 'firm' },
  { id: 107, pair: 'MOTO/tBTC', side: 'buy', size: 26, spread: 41, settlement: 'expired' },
  { id: 108, pair: 'PIL/tBTC', side: 'buy', size: 150_000, spread: 15, settlement: 'firm' },
];

const COUNTERPARTIES = [
  { name: 'North Relay', focus: 'PIL block flow', score: 'A', fill: '92% firm' },
  { name: 'Moto Syndicate', focus: 'MOTO inventory', score: 'A-', fill: '86% firm' },
  { name: 'Signet Crossing', focus: 'Cross-pair quotes', score: 'B+', fill: '79% firm' },
] as const;

const DOCTRINE = [
  {
    title: 'Stage before you route',
    body: 'Every execution lane starts with an explicit contract source so the desk never pretends demo data is live settlement.',
    icon: ShieldCheck,
  },
  {
    title: 'Compare before you cross',
    body: 'Shortlist the best lanes side by side and only then accept or counter the quote. This keeps the terminal operational, not decorative.',
    icon: ArrowRightLeft,
  },
  {
    title: 'Read latency like risk',
    body: 'Spread is not the only variable. Settlement speed and firm-fill ratio are first-class operator signals.',
    icon: Clock3,
  },
] as const;

function isLikelyContract(value: string): boolean {
  return /^opt1[a-z0-9]{10,}$/.test(value) || /^tb1[a-z0-9]{10,}$/i.test(value);
}

function readStoredAddress(): string {
  if (typeof window === 'undefined') return DEFAULT_CONTRACT;
  return window.localStorage.getItem(STORAGE_KEY)?.trim() || DEFAULT_CONTRACT;
}

function formatSize(value: number, pair: string): string {
  if (pair.startsWith('PIL')) return `${value.toLocaleString()} PIL`;
  return `${value.toLocaleString()} units`;
}

function Ladder({ quotes }: { quotes: QuoteRow[] }) {
  const maxSpread = Math.max(...quotes.map((quote) => quote.spread));

  return (
    <article className="desk-card ladder-card">
      <header>
        <p>Spread ladder</p>
        <h2>Execution board</h2>
      </header>
      <div className="ladder-head">
        <span>Pair</span>
        <span>Side</span>
        <span>Spread</span>
      </div>
      {quotes.map((quote) => (
        <div key={quote.id} className="ladder-row">
          <span>{quote.pair}</span>
          <span className={quote.side}>{quote.side}</span>
          <div className="ladder-bar">
            <div style={{ width: `${(quote.spread / maxSpread) * 100}%` }} />
            <strong>{quote.spread} bps</strong>
          </div>
        </div>
      ))}
    </article>
  );
}

function Timeline() {
  const bars = [26, 44, 39, 51, 48, 60, 53, 72];

  return (
    <article className="desk-card timeline-card">
      <header>
        <p>Settlement</p>
        <h2>Latency trace</h2>
      </header>
      <div className="timeline-bars">
        {bars.map((bar, index) => (
          <div key={index} className="timeline-item">
            <div style={{ height: `${bar}%` }} />
            <span>T{index + 1}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

export default function App() {
  const { publicKey, walletAddress, walletBalance, openConnectModal, disconnect, network } = useWalletConnect();
  const [search, setSearch] = useState('');
  const [sideFilter, setSideFilter] = useState<'all' | Side>('all');
  const [contractAddress, setContractAddress] = useState(DEFAULT_CONTRACT);
  const [contractInput, setContractInput] = useState(DEFAULT_CONTRACT);
  const [runtime, setRuntime] = useState<RuntimeState>('idle');
  const [actionNotice, setActionNotice] = useState('Desk in demo lane until a valid contract is staged.');

  useEffect(() => {
    const stored = readStoredAddress();
    setContractAddress(stored);
    setContractInput(stored);
  }, []);

  useEffect(() => {
    if (!contractAddress) {
      setRuntime('idle');
      return;
    }
    setRuntime(isLikelyContract(contractAddress) ? 'staged' : 'invalid');
  }, [contractAddress]);

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return QUOTES.filter((quote) => {
      if (sideFilter !== 'all' && quote.side !== sideFilter) return false;
      if (!query) return true;
      return `${quote.id} ${quote.pair} ${quote.side}`.toLowerCase().includes(query);
    });
  }, [search, sideFilter]);

  const compareRows = rows.slice(0, 3);
  const deskTape = useMemo(() => ([
    { label: 'Runtime', value: runtime },
    { label: 'Visible tickets', value: String(rows.length) },
    { label: 'Search lane', value: search.trim() || 'wide open' },
    { label: 'Side filter', value: sideFilter },
  ]), [runtime, rows.length, search, sideFilter]);

  function applyContract() {
    const next = contractInput.trim();
    setContractAddress(next);
    if (typeof window !== 'undefined') {
      if (next) window.localStorage.setItem(STORAGE_KEY, next);
      else window.localStorage.removeItem(STORAGE_KEY);
    }
    setActionNotice(next ? 'Contract source restaged for OTC lanes.' : 'Desk returned to demo-only mode.');
  }

  function quoteAction(label: string) {
    setRuntime('executing');
    setActionNotice(`${label} routed into the execution queue.`);
    window.setTimeout(() => setRuntime(contractAddress && isLikelyContract(contractAddress) ? 'staged' : 'idle'), 800);
  }

  return (
    <div className="desk-shell">
      <header className="desk-top">
        <div className="desk-brand">
          <p>OpenNet terminal</p>
          <h1>OTC Desk</h1>
        </div>
        <div className="desk-actions">
          <span className={`runtime-pill ${runtime}`}>{runtime}</span>
          <span className="network-pill">{network?.network || 'no wallet'}</span>
          {publicKey ? (
            <button type="button" className="wallet-ghost" onClick={disconnect}>
              <Wallet size={15} />
              {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Connected'}
            </button>
          ) : (
            <button type="button" className="wallet-cta" onClick={openConnectModal}>
              <Wallet size={15} />
              Connect
            </button>
          )}
        </div>
      </header>

      <main className="desk-grid">
        <section className="desk-card blotter-card">
          <header className="blotter-header">
            <div>
              <p>Live blotter</p>
              <h2>Quote lanes</h2>
            </div>
            <div className="blotter-tools">
              <label className="search-box">
                <Search size={14} />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="search pair or ticket" />
              </label>
              <button type="button" className={sideFilter === 'all' ? 'active' : ''} onClick={() => setSideFilter('all')}>All</button>
              <button type="button" className={sideFilter === 'buy' ? 'active' : ''} onClick={() => setSideFilter('buy')}>Buy</button>
              <button type="button" className={sideFilter === 'sell' ? 'active' : ''} onClick={() => setSideFilter('sell')}>Sell</button>
            </div>
          </header>

          <div className="blotter-head">
            <span>Ticket</span>
            <span>Pair</span>
            <span>Side</span>
            <span>Size</span>
            <span>State</span>
            <span>Action</span>
          </div>

          <div className="blotter-body">
            {rows.map((quote) => (
              <div key={quote.id} className="blotter-row">
                <span>#{quote.id}</span>
                <span>{quote.pair}</span>
                <span className={quote.side}>{quote.side}</span>
                <span>{formatSize(quote.size, quote.pair)}</span>
                <span className={`settlement ${quote.settlement}`}>{quote.settlement}</span>
                <button type="button" onClick={() => quoteAction(quote.side === 'buy' ? 'Accept quote' : 'Counter quote')}>
                  <ArrowRightLeft size={14} />
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="desk-side">
          <Ladder quotes={rows.length ? rows : QUOTES} />
          <Timeline />

          <article className="desk-card compare-card">
            <header>
              <p>Compare drawer</p>
              <h2>Best current lanes</h2>
            </header>
            <div className="compare-stack">
              {compareRows.map((quote) => (
                <article key={quote.id}>
                  <div>
                    <strong>{quote.pair}</strong>
                    <span>{quote.side} · {quote.settlement}</span>
                  </div>
                  <b>{quote.spread} bps</b>
                </article>
              ))}
            </div>
          </article>

          <article className="desk-card strip-card">
            <header>
              <p>Desk rail</p>
              <h2>Operator cues</h2>
            </header>
            <div className="stats-strip">
              <article>
                <Gauge size={15} />
                <span>Latency</span>
                <strong>38 ms</strong>
              </article>
              <article>
                <ReceiptText size={15} />
                <span>Wallet</span>
                <strong>{walletBalance ? `${(Number(walletBalance.confirmed) / 1e8).toFixed(4)} tBTC` : 'Idle'}</strong>
              </article>
              <article>
                <Filter size={15} />
                <span>Tickets</span>
                <strong>{rows.length}</strong>
              </article>
            </div>
          </article>
        </section>

        <section className="desk-card contract-card">
          <header>
            <div>
              <p>Contract source</p>
              <h2>Settlement rail</h2>
            </div>
            <span className="notice-line">{actionNotice}</span>
          </header>
          <div className="contract-row">
            <input value={contractInput} onChange={(event) => setContractInput(event.target.value)} placeholder="opt1..." />
            <button type="button" onClick={applyContract}>Stage</button>
            <button type="button" onClick={() => {
              if (contractAddress) {
                void navigator.clipboard.writeText(contractAddress);
                setActionNotice('Contract copied from desk rail.');
              }
            }}>
              <Copy size={14} />
            </button>
            {contractAddress && (
              <a href={`https://testnet.opscan.org/account/${contractAddress}`} target="_blank" rel="noreferrer">
                <ExternalLink size={14} />
              </a>
            )}
          </div>
        </section>

        <section className="desk-card tape-card" aria-label="Desk tape">
          <header>
            <p>Market tape</p>
            <h2>Terminal context</h2>
          </header>
          <div className="tape-grid">
            {deskTape.map((item) => (
              <article key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </article>
            ))}
          </div>
        </section>

        <section className="terminal-depth">
          <article className="desk-card counterparty-card">
            <header>
              <p>Counterparty map</p>
              <h2>Who is actually filling size</h2>
            </header>
            <div className="counterparty-stack">
              {COUNTERPARTIES.map((party) => (
                <article key={party.name}>
                  <div className="counterparty-main">
                    <Users size={15} />
                    <div>
                      <strong>{party.name}</strong>
                      <span>{party.focus}</span>
                    </div>
                  </div>
                  <div className="counterparty-meta">
                    <b>{party.score}</b>
                    <small>{party.fill}</small>
                  </div>
                </article>
              ))}
            </div>
          </article>

          <article className="desk-card doctrine-card">
            <header>
              <p>Desk doctrine</p>
              <h2>Execution principles</h2>
            </header>
            <div className="doctrine-list">
              {DOCTRINE.map((item) => (
                <article key={item.title}>
                  <item.icon size={15} />
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.body}</span>
                  </div>
                </article>
              ))}
            </div>
          </article>
        </section>

        <footer className="terminal-footer">
          <div>
            <p>OTC lanes need state, counterparties and settlement context. Otherwise it is just a table in a dark theme.</p>
          </div>
          <div className="terminal-links">
            <span>Desk fits PIL blocks, MOTO inventory and bilateral testnet settlement.</span>
            <a href="https://docs.opnet.org" target="_blank" rel="noreferrer">OPNet docs</a>
          </div>
        </footer>
      </main>
    </div>
  );
}
