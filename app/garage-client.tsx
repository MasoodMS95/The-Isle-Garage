'use client';
/* oxlint-disable next/no-img-element -- Bundled artwork needs no image service. */
import Link from 'next/link';
import {
  directoryServers,
  officialDisplay,
  matchesServerQuery,
} from '@/lib/server-catalog';
import { speciesArtwork, speciesList } from '@/lib/species-art';
import { authClient } from '@/lib/auth-client';

import { useEffect, useState, useRef } from 'react';
import { flushSync } from 'react-dom';
import MenuSound from './menu-sound';
import ShareManager from './share-manager';
import {
  dino,
  forAccount,
  saveAccountView,
  growthText,
} from '@/lib/garage-model';
import { stages } from '@/lib/garage-types';
import type { Server, RecordState, GameAccount } from '@/lib/garage-types';
import {
  ArrowUpRight,
  ChevronRight,
  Compass,
  Copy,
  Leaf,
  Pause,
  Play,
  Plus,
  Search,
  Share2,
  Star,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export default function Garage({
  initialRecords,
  initialAccounts,
  initialVersion,
  ownerName,
}: {
  initialRecords: Server[] | null;
  initialAccounts: GameAccount[];
  initialVersion: number;
  ownerName: string;
}) {
  const [allServers, setAllServers] = useState<Server[]>(
    (initialRecords || []).map((s) => officialDisplay({ ...s, ...dino(s) })),
  );
  const [accounts, setAccounts] = useState(initialAccounts);
  const [accountId, selectAccount] = useState('main');
  function setAccountId(id: string) {
    setEdit(null);
    selectAccount(id);
  }
  const [manageAccounts, setManageAccounts] = useState(false);
  const [accountName, setAccountName] = useState('');
  const [accountError, setAccountError] = useState('');
  const [renameId, setRenameId] = useState<string | null>(null);
  const servers = allServers.map((s) => forAccount(s, accountId));
  function setServers(value: Server[] | ((old: Server[]) => Server[])) {
    setAllServers((old) =>
      saveAccountView(
        old,
        typeof value === 'function'
          ? value(old.map((s) => forAccount(s, accountId)))
          : value,
        accountId,
      ),
    );
  }
  const snapshot = useRef({ records: allServers, accounts });
  useEffect(() => {
    snapshot.current = { records: allServers, accounts };
  }, [allServers, accounts]);

  const [legacy, setLegacy] = useState<Server[] | null>(null);
  const [saveState, setSaveState] = useState('saved');
  const [changed, setChanged] = useState(0);
  const revision = useRef(initialVersion);
  const saveChain = useRef(Promise.resolve());
  const [paused, setPaused] = useState(false);
  const [camera, setCamera] = useState(1);
  const cameras = [
    { name: 'Wetland perimeter', image: '/wetland.png', position: '70% 50%' },
    { name: 'North paddock', image: '/paddock.png', position: '50% 50%' },
    { name: 'Service access', image: '/paddock.png', position: '30% 75%' },
    { name: 'Eastern treeline', image: '/wetland.png', position: '95% 40%' },
  ];
  const [tab, setTab] = useState('mine');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All servers');
  const [edit, setEdit] = useState<Server | null>(null);
  const [share, setShare] = useState(false);
  const [info, setInfo] = useState(false);
  const [notice, setNotice] = useState('');
  const [custom, setCustom] = useState('');
  const currentServers = useRef(servers);
  useEffect(() => {
    currentServers.current = servers;
  }, [servers]);
  useEffect(() => {
    const ctx = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: object,
            options: { signal: AbortSignal },
          ) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!ctx?.registerTool) return;
    const lifecycle = new AbortController();
    const tools = [
      {
        name: 'read_garage',
        description:
          'Read this browser-local prototype garage. User supplied records are not live game data.',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: () =>
          currentServers.current.map(
            ({ id, name, favorite, state, species, growth }) => ({
              id,
              name,
              favorite,
              state,
              species,
              growth,
            }),
          ),
      },
      {
        name: 'open_dinosaur_editor',
        description:
          'Open the editor for a server record. Does not save or alter the dinosaur.',
        inputSchema: {
          type: 'object',
          properties: { serverId: { type: 'string' } },
          required: ['serverId'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        execute: (input: unknown) => {
          if (
            !input ||
            typeof input !== 'object' ||
            !('serverId' in input) ||
            typeof input.serverId !== 'string'
          )
            throw new Error('serverId is required');
          const record = currentServers.current.find(
            (s) => s.id === input.serverId,
          );
          if (!record) throw new Error('Server not found');
          flushSync(() => setEdit({ ...record }));
          return { serverId: record.id, editorOpen: true, saved: false };
        },
      },
    ];
    for (const tool of tools)
      try {
        void Promise.resolve(
          ctx.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => {});
      } catch {}
    return () => lifecycle.abort();
  }, []);
  useEffect(() => {
    queueMicrotask(() => {
      if (!initialRecords)
        try {
          const old = localStorage.getItem('isle-garage-prototype-v1');
          if (old) {
            const parsed = JSON.parse(old);
            if (
              Array.isArray(parsed) &&
              parsed.every(
                (s) => typeof s.id === 'string' && typeof s.name === 'string',
              )
            )
              setLegacy(parsed);
          }
        } catch {}
      setPaused(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    });
  }, [initialRecords]);
  useEffect(() => {
    if (!changed) return;
    const timer = setTimeout(() => {
      const { records, accounts: savedAccounts } = snapshot.current;
      saveChain.current = saveChain.current.then(async () => {
        try {
          const response = await fetch('/api/garage', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              records,
              accounts: savedAccounts,
              version: revision.current,
            }),
          });
          const data = (await response.json()) as {
            error?: string;
            version: number;
            records: Server[];
          };
          if (!response.ok) throw new Error(data.error || 'Save failed');
          revision.current = data.version;
          if (
            snapshot.current.records === records &&
            snapshot.current.accounts === savedAccounts
          ) {
            setAllServers(data.records);
            setSaveState('saved');
            setLegacy(null);
          }
        } catch (e) {
          setSaveState('error');
          setNotice(
            e instanceof Error ? e.message : 'Could not save your garage',
          );
        }
      });
    }, 450);
    return () => clearTimeout(timer);
  }, [changed]);
  function markChanged() {
    setSaveState('saving');
    setChanged((v) => v + 1);
  }
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(''), 5000);
    return () => clearTimeout(timeout);
  }, [notice]);
  function update(server: Server) {
    markChanged();
    setServers((old) =>
      old.some((s) => s.id === server.id)
        ? old.map((s) => (s.id === server.id ? server : s))
        : [...old, server],
    );
  }
  function toggleFavorite(server: Server) {
    update({ ...server, favorite: !server.favorite });
  }
  function save() {
    if (!edit) return;
    if (
      edit.growthMode === 'percent' &&
      (!Number.isFinite(edit.growth) || edit.growth < 1 || edit.growth > 100)
    ) {
      setNotice('Enter growth from 1 to 100, or choose Unknown.');
      return;
    }
    if (edit.growthMode === 'stage' && !edit.growthStage) {
      setNotice('Choose a growth stage.');
      return;
    }
    update({ ...edit, updated: new Date().toISOString() });
    setEdit(null);
    setNotice('Record updated. Your server stays in My Servers.');
  }
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice('Copied to clipboard.');
    } catch {
      setNotice('Copy unavailable. Select and copy the text instead.');
    }
  }
  function addCustom() {
    if (!custom.trim()) return;
    const id = crypto.randomUUID();
    markChanged();
    setServers((old) => [
      ...old,
      {
        id,
        name: custom.trim(),
        community: 'Your server',
        kind: 'Custom',
        favorite: true,
        state: 'No dinosaur',
        species: '',
        growth: 0,
        code: '',
        photo: '',
      },
    ]);
    setCustom('');
    setTab('mine');
    setNotice('Server added to My Servers.');
  }
  const favorites = servers.filter((s) => s.favorite);
  const alive = favorites.filter((s) => s.state === 'Living').length;
  const filtered = directoryServers(servers).filter(
    (s) =>
      (filter === 'All servers' || s.kind === filter) &&
      matchesServerQuery(s, query),
  );

  function card(s: Server) {
    return (
      <article
        className={'server-card ' + (s.state === 'Living' ? 'living' : '')}
        key={s.id}
      >
        <div className="card-top">
          <div className="server-identity">
            <h3>{s.name}</h3>
          </div>
          <button
            className="icon-button favorite"
            aria-label={(s.favorite ? 'Unfavorite ' : 'Favorite ') + s.name}
            aria-pressed={s.favorite}
            onClick={() => toggleFavorite(s)}
          >
            <Star size={17} fill={s.favorite ? 'currentColor' : 'none'} />
          </button>
        </div>
        <div className="dino-row">
          <div
            className={'dino-symbol ' + s.state.toLowerCase().replace(' ', '-')}
          >
            {s.state === 'No dinosaur' ? (
              <Plus />
            ) : (
              <img
                src={speciesArtwork(s.species).src}
                alt={speciesArtwork(s.species).alt}
                width={112}
                height={70}
              />
            )}
          </div>
          <div className="dino-identity">
            <span
              className={
                'status status-' + s.state.toLowerCase().replace(' ', '-')
              }
            >
              {s.state === 'Living'
                ? '●  PARKED'
                : s.state === 'Dead'
                  ? 'DEAD'
                  : s.state.toUpperCase()}
            </span>
            <h4 className={s.prime ? 'prime-species' : undefined}>
              {s.species === 'Tyrannosaurus'
                ? 'T-Rex'
                : s.species || 'No dinosaur'}
              {s.prime && <span className="prime-badge">PRIME</span>}
            </h4>
            <span className="record-note">
              {s.state === 'No dinosaur'
                ? 'Ready for your next dinosaur.'
                : s.updated
                  ? 'Manually updated ' +
                    new Date(s.updated).toLocaleDateString()
                  : 'Not yet updated'}
            </span>
          </div>
          {s.state === 'Living' && (
            <div className="growth" data-mode={s.growthMode}>
              <strong>{growthText(s)}</strong>
              <span>GROWTH</span>
            </div>
          )}
        </div>
        {s.state === 'Living' && s.growthMode === 'percent' && (
          <meter
            className="growth-line"
            aria-label="Growth"
            value={s.growth}
            min={0}
            max={100}
          />
        )}
        <div className="card-bottom">
          <button
            className="text-button"
            onClick={() =>
              setEdit({
                ...s,
                ...(s.state === 'Dead' || s.state === 'No dinosaur'
                  ? {
                      state: 'Living' as RecordState,
                      species: speciesList[0],
                      growth: 0,
                      growthMode: 'unknown',
                      growthStage: '',
                      prime: false,
                      code: '',
                      photo: '',
                    }
                  : {}),
              })
            }
          >
            {s.state === 'Living' || s.state === 'Unknown'
              ? 'Quick edit'
              : 'Park a dinosaur'}
            <ChevronRight size={16} />
          </button>
        </div>
      </article>
    );
  }
  return (
    <main className={paused ? 'garage motion-paused' : 'garage'}>
      <div className="world" aria-hidden="true" />
      <div className="world-shade" aria-hidden="true" />
      <div className="mist" aria-hidden="true" />
      <div className="terminal-shell">
        <header className="topbar">
          <Link className="brand" href="/" aria-label="The Isle Garage home">
            <span className="brand-mark">
              <Leaf size={25} />
            </span>
            <span>
              THE ISLE<span className="brand-sub">GARAGE</span>
            </span>
          </Link>
          <span className="edition">PARK OPERATIONS / PERSONAL TERMINAL</span>
          <button className="profile" onClick={() => setInfo(true)}>
            <span className="avatar">G</span>
            <span>
              {ownerName}
              <small>garage account</small>
            </span>
            <ChevronRight size={15} />
          </button>
        </header>
        <div className="workspace">
          <section className="main-panel">
            <div className="page-heading">
              <span className="eyebrow moss">PERSONAL RECORDS / 01</span>
              <h1>
                My garage
                <span className="terminal-cursor" aria-hidden="true">
                  _
                </span>
              </h1>
              <p>EVRIMA · MANUAL TRACKING</p>
            </div>
            <div className="save-indicator">
              {saveState === 'saved'
                ? allServers.length
                  ? 'Saved privately'
                  : 'Your garage is empty · Add a server to begin'
                : saveState === 'saving'
                  ? 'Saving…'
                  : saveState === 'error'
                    ? 'Save failed — retry before sharing'
                    : 'Changes not yet saved'}
              {saveState === 'error' && (
                <button className="text-button" onClick={markChanged}>
                  {' '}
                  Retry save
                </button>
              )}
            </div>
            {legacy && (
              <div className="migration-notice">
                Records from this browser are available. Import them into this
                garage account?
                <button
                  onClick={() => {
                    setAllServers(legacy.map((s) => ({ ...s, ...dino(s) })));
                    setAccountId('main');
                    markChanged();
                  }}
                >
                  Import browser records
                </button>
              </div>
            )}
            <section className="account-switcher" aria-label="Game accounts">
              <div className="account-heading">
                <span>GAME ACCOUNT</span>
                <button
                  className="text-button"
                  onClick={() => {
                    setManageAccounts(true);
                    setAccountError('');
                    setRenameId(null);
                    setAccountName('');
                  }}
                >
                  Manage accounts
                </button>
              </div>
              <fieldset
                className="account-tabs"
                aria-label="Select game account"
              >
                {accounts.map((a) => (
                  <button
                    key={a.id}
                    aria-pressed={a.id === accountId}
                    onClick={() => setAccountId(a.id)}
                  >
                    {a.label}
                  </button>
                ))}
              </fieldset>
              <select
                className="account-select"
                aria-label="Game account"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </section>
            <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
              <div className="tab-row">
                <TabsList variant="line">
                  <TabsTrigger value="mine">
                    <Star size={15} />
                    My Servers <span className="count">{favorites.length}</span>
                  </TabsTrigger>
                  <TabsTrigger value="discover">
                    <Compass size={16} />
                    Discover
                  </TabsTrigger>
                </TabsList>
                {tab === 'mine' && (
                  <button
                    className="text-button share-garage-button"
                    onClick={() => setShare(true)}
                  >
                    <Share2 size={15} aria-hidden="true" />
                    Share garage
                  </button>
                )}
              </div>
              <TabsContent value="mine">
                <div className="section-caption">
                  <span>
                    {alive} living {alive === 1 ? 'dinosaur' : 'dinosaurs'}{' '}
                    <b>·</b> {favorites.length} favorite servers
                  </span>
                  <button
                    className="text-button"
                    onClick={() => setTab('discover')}
                  >
                    <Plus size={15} />
                    Add server
                  </button>
                </div>
                <div className="server-list">
                  {favorites.map(card)}
                  {favorites.length === 0 && (
                    <div className="empty">
                      <Compass size={32} />
                      <h3>Make yourself at home.</h3>
                      <p>Favorite a server to begin your garage.</p>
                      <button
                        className="primary-button"
                        onClick={() => setTab('discover')}
                      >
                        Discover servers
                      </button>
                    </div>
                  )}
                </div>
              </TabsContent>
              <TabsContent value="discover">
                <div className="search-row">
                  <label className="search">
                    <Search size={17} />
                    <input
                      aria-label="Search servers"
                      placeholder="Find your next home…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                  <Select
                    value={filter}
                    onValueChange={(v) => setFilter(v || 'All servers')}
                  >
                    <SelectTrigger aria-label="Server type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['All servers', 'Official', 'Community', 'Custom'].map(
                        (v) => (
                          <SelectItem key={v} value={v}>
                            {v}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <p className="catalog-note">
                  Official servers from in-game observations · availability is
                  not live. Community preview instances are illustrative.
                </p>
                <div className="directory-list">
                  {filtered.map((s) => (
                    <article className="directory-item" key={s.id}>
                      <div>
                        <h3>{s.name}</h3>
                        <span>{s.kind}</span>
                      </div>
                      <button
                        className="icon-button"
                        aria-label={
                          (s.favorite ? 'Unfavorite ' : 'Favorite ') + s.name
                        }
                        aria-pressed={s.favorite}
                        onClick={() => toggleFavorite(s)}
                      >
                        <Star
                          size={18}
                          fill={s.favorite ? 'currentColor' : 'none'}
                        />
                      </button>
                    </article>
                  ))}
                  {filtered.length === 0 && (
                    <p className="empty">
                      No matching servers. Add yours below.
                    </p>
                  )}
                </div>
                <form
                  className="manual-add"
                  onSubmit={(e) => {
                    e.preventDefault();
                    addCustom();
                  }}
                >
                  <label htmlFor="custom">Can’t find your server?</label>
                  <div>
                    <input
                      id="custom"
                      placeholder="Enter its exact name"
                      maxLength={100}
                      value={custom}
                      onChange={(e) => setCustom(e.target.value)}
                    />
                    <button
                      className="primary-button"
                      disabled={!custom.trim()}
                    >
                      Add server
                    </button>
                  </div>
                </form>
              </TabsContent>
            </Tabs>
            <div className="local-note">
              Private account-owned records. Only lists you publish are public.
              Parking does not save a dinosaur in-game.
            </div>
          </section>
          <aside
            className="observation-panel"
            aria-label="Simulated dinosaur park observation terminal"
          >
            <div className="observation-header">
              <span>Somewhere on The Isle</span>
              <span className="demo-marker">DEMO FEED</span>
            </div>
            <fieldset className="camera-strip" aria-label="Observation stills">
              {cameras.map((cam, index) => (
                <button
                  className={
                    'camera-button ' + (camera === index ? 'selected' : '')
                  }
                  key={cam.name}
                  aria-pressed={camera === index}
                  aria-label={'View ' + cam.name + ' illustration'}
                  onClick={() => setCamera(index)}
                >
                  <img
                    src={cam.image}
                    alt=""
                    style={{ objectPosition: cam.position }}
                  />
                  <span>CAM / 0{index + 1}</span>
                </button>
              ))}
            </fieldset>
            <div className={'camera-feed camera-' + camera}>
              <img
                src={cameras[camera].image}
                alt={
                  'Original illustrative dinosaur park still: ' +
                  cameras[camera].name
                }
                style={{ objectPosition: cameras[camera].position }}
              />
              <div className="scanlines" aria-hidden="true" />
              <div className="scan-sweep" aria-hidden="true" />
              <div className="feed-top">
                <span>CAM 0{camera + 1} / PARK PERIMETER</span>
                <span>SIMULATION</span>
              </div>
              <span className="reticle reticle-tl" aria-hidden="true" />
              <span className="reticle reticle-tr" aria-hidden="true" />
              <span className="reticle reticle-bl" aria-hidden="true" />
              <span className="reticle reticle-br" aria-hidden="true" />
              <div className="feed-bottom">
                <span>{cameras[camera].name.toUpperCase()}</span>
                <span>FRAME 00{184 + camera}</span>
              </div>
            </div>
            <div className="feed-status">
              <span>
                <i />
                OBSERVATION MODE
              </span>
              <span>{paused ? 'EFFECTS PAUSED' : 'DISPLAY ACTIVE'}</span>
            </div>
            <p className="simulation-note">
              Original still artwork with simulated display effects. No live
              camera or game connection.
            </p>
            <div className="terminal-readout">
              <span>GARAGE INDEX</span>
              <div>
                <strong>{String(favorites.length).padStart(2, '0')}</strong>
                <span>SAVED SERVERS</span>
                <strong>{String(alive).padStart(2, '0')}</strong>
                <span>LIVING RECORDS</span>
                <button className="text-button" onClick={() => setShare(true)}>
                  SHARE PREVIEW <ArrowUpRight size={14} />
                </button>
              </div>
            </div>
          </aside>
        </div>
        <footer>
          <span>
            THE ISLE GARAGE <b>/</b> UNOFFICIAL FAN PROJECT
          </span>
          <button
            className="motion-control"
            aria-pressed={paused}
            onClick={() => setPaused((v) => !v)}
          >
            {paused ? <Play size={14} /> : <Pause size={14} />}{' '}
            {paused ? 'Resume effects' : 'Pause effects'}
          </button>
          <MenuSound />
          <span className="art-credit">Original illustrative artwork</span>
        </footer>
      </div>
      <Dialog
        open={!!edit}
        onOpenChange={(open) => {
          if (!open) setEdit(null);
        }}
      >
        <DialogContent className="garage-dialog">
          <DialogTitle>Dinosaur record</DialogTitle>
          <DialogDescription>
            {accounts.find((a) => a.id === accountId)?.label} · {edit?.name} ·
            manually tracked dinosaur
          </DialogDescription>
          {edit && (
            <form
              className="edit-form"
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
            >
              <div className="field-grid">
                <label htmlFor="species">
                  Species
                  <Select
                    value={edit.species || speciesList[0]}
                    onValueChange={(v) =>
                      setEdit({ ...edit, species: v || speciesList[0] })
                    }
                  >
                    <SelectTrigger id="species">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {edit.species &&
                        !speciesList.some((v) => v === edit.species) && (
                          <SelectItem value={edit.species}>
                            {edit.species}
                          </SelectItem>
                        )}
                      {speciesList.map((v) => (
                        <SelectItem key={v} value={v}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label htmlFor="dino-status">
                  Status
                  <Select
                    value={edit.state}
                    onValueChange={(v) =>
                      setEdit({ ...edit, state: v as RecordState })
                    }
                  >
                    <SelectTrigger id="dino-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['Living', 'Dead', 'Unknown'].map((v) => (
                        <SelectItem key={v} value={v}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              </div>
              <div className="growth-fields">
                <label>
                  Growth format
                  <select
                    value={edit.growthMode || 'unknown'}
                    onChange={(e) =>
                      setEdit({
                        ...edit,
                        growthMode: e.target.value as Server['growthMode'],
                        growth: 0,
                        growthStage: '',
                      })
                    }
                  >
                    <option value="unknown">Unknown / unset</option>
                    <option value="percent">Percentage</option>
                    <option value="stage">Stage</option>
                  </select>
                </label>
                {edit.growthMode === 'percent' && (
                  <label>
                    Growth %
                    <input
                      aria-label="Growth percentage"
                      type="number"
                      min={1}
                      max={100}
                      step="any"
                      required
                      value={edit.growth || ''}
                      onChange={(e) =>
                        setEdit({
                          ...edit,
                          growth:
                            e.target.value === '' ? 0 : Number(e.target.value),
                        })
                      }
                    />
                  </label>
                )}
                {edit.growthMode === 'stage' && (
                  <label>
                    Growth stage
                    <select
                      required
                      value={edit.growthStage || ''}
                      onChange={(e) =>
                        setEdit({
                          ...edit,
                          growthStage: e.target.value as Server['growthStage'],
                        })
                      }
                    >
                      <option value="">Choose stage</option>
                      {stages.map((stage) => (
                        <option key={stage} value={stage}>
                          {stage}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              <label className="prime-choice">
                <input
                  type="checkbox"
                  checked={!!edit.prime}
                  onChange={(e) =>
                    setEdit({ ...edit, prime: e.target.checked })
                  }
                />{' '}
                Prime{' '}
                <span className="optional">tracked separately from growth</span>
              </label>
              <label>
                Skin code <span className="optional">optional</span>
                <textarea
                  placeholder="Paste your in-game skin code"
                  maxLength={2000}
                  value={edit.code}
                  onChange={(e) => setEdit({ ...edit, code: e.target.value })}
                />
              </label>
              {edit.code && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => copy(edit.code)}
                >
                  <Copy size={15} />
                  Copy skin code
                </button>
              )}
              {edit.state !== 'No dinosaur' && (
                <img
                  className="species-preview"
                  src={speciesArtwork(edit.species).src}
                  alt={speciesArtwork(edit.species).alt}
                  width={320}
                  height={200}
                />
              )}
              <div className="form-actions">
                <button
                  type="button"
                  className="text-button subdued"
                  onClick={() => {
                    update({
                      ...edit,
                      state: 'No dinosaur',
                      species: '',
                      growth: 0,
                      growthMode: 'unknown',
                      growthStage: '',
                      prime: false,
                      code: '',
                      photo: '',
                      updated: new Date().toISOString(),
                    });
                    setEdit(null);
                    // oxlint-disable-next-line react/react-compiler -- Surface an external storage failure.
                    setNotice(
                      'Dinosaur cleared. Your favorite server remains.',
                    );
                  }}
                >
                  Clear dinosaur
                </button>
                <button className="primary-button">
                  Save record <ChevronRight size={16} />
                </button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={manageAccounts} onOpenChange={setManageAccounts}>
        <DialogContent className="garage-dialog">
          <DialogTitle>Game accounts</DialogTitle>
          <DialogDescription>
            Labels for your game accounts, separate from your website sign-in.
            All accounts use the same favorite servers.
          </DialogDescription>
          <div className="account-manage-list">
            {accounts.map((a) => (
              <div key={a.id}>
                <span>{a.label}</span>
                <button
                  className="text-button"
                  onClick={() => {
                    setRenameId(a.id);
                    setAccountName(a.label);
                    setAccountError('');
                  }}
                >
                  Rename
                </button>
              </div>
            ))}
          </div>
          <form
            className="edit-form"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              const label = accountName.trim();
              if (!label) {
                setAccountError('Enter an account label.');
                return;
              }
              if (label.length > 40) {
                setAccountError('Use 40 characters or fewer.');
                return;
              }
              if (
                accounts.some(
                  (a) =>
                    a.id !== renameId &&
                    a.label.toLowerCase() === label.toLowerCase(),
                )
              ) {
                setAccountError(
                  'That label is already used. Choose a different label.',
                );
                return;
              }
              setAccountError('');
              if (renameId)
                setAccounts((old) =>
                  old.map((a) => (a.id === renameId ? { ...a, label } : a)),
                );
              else {
                if (accounts.length >= 20) {
                  setAccountError('Up to 20 accounts are supported.');
                  return;
                }
                const id = crypto.randomUUID();
                setAccounts((old) => [...old, { id, label }]);
                setAccountId(id);
              }
              markChanged();
              setAccountName('');
              setRenameId(null);
            }}
          >
            <label>
              {renameId ? 'Rename account' : 'New account label'}
              <input
                required
                maxLength={40}
                value={accountName}
                aria-invalid={!!accountError}
                aria-describedby="account-label-help account-label-error"
                onChange={(e) => {
                  setAccountName(e.target.value);
                  setAccountError('');
                }}
              />
            </label>
            <small id="account-label-help">
              Use a unique label, up to 40 characters.
            </small>
            <p id="account-label-error" className="field-error" role="alert">
              {accountError}
            </p>
            <div className="form-actions">
              <button className="primary-button">
                {renameId ? 'Save label' : 'Add account'}
              </button>
              {renameId && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    setRenameId(null);
                    setAccountName('');
                    setAccountError('');
                  }}
                >
                  Cancel rename
                </button>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={share} onOpenChange={setShare}>
        <DialogContent className="garage-dialog">
          <DialogTitle>Share your garage</DialogTitle>
          <DialogDescription>
            Publish selected records, then copy a stable link.
          </DialogDescription>
          <ShareManager
            servers={allServers}
            accounts={accounts}
            initialAccountId={accountId}
            saved={saveState === 'saved'}
            onSave={markChanged}
          />
        </DialogContent>
      </Dialog>
      <Dialog open={info} onOpenChange={setInfo}>
        <DialogContent className="garage-dialog">
          <DialogTitle>Operator session</DialogTitle>
          <DialogDescription>
            Your verified email sign-in protects your private garage.
          </DialogDescription>
          <p>
            Try favoriting servers, parking a dinosaur, and updating its growth
            or skin. Records are saved privately to your garage account.
          </p>
          <p>
            Game-account labels help organize your records. They do not connect
            to Steam or read live game data.
          </p>
          <div className="session-actions">
            <button className="primary-button" onClick={() => setInfo(false)}>
              Explore the garage <ArrowUpRight size={16} />
            </button>
            <button
              className="text-button"
              onClick={async () => {
                const result = await authClient.signOut();
                if (result.error) {
                  setNotice('Sign out failed. Please try again.');
                  return;
                }
                window.location.assign('/login');
              }}
            >
              Sign out
            </button>
          </div>
        </DialogContent>
      </Dialog>
      {notice && <output className="notice">{notice}</output>}
    </main>
  );
}
