'use client';
/* oxlint-disable next/no-img-element -- User-selected browser-local data URLs need no image service. */
import Link from 'next/link';

import { useEffect, useState, useRef } from 'react';
import { flushSync } from 'react-dom';
import MenuSound from './menu-sound';
import ShareManager from './share-manager';
import type { Server, RecordState } from '@/lib/garage-types';
import {
  ArrowUpRight,
  ChevronRight,
  Compass,
  Copy,
  Feather,
  Leaf,
  Pause,
  Play,
  Plus,
  Search,
  Share2,
  Skull,
  Star,
  X,
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
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

const initial: Server[] = [
  {
    id: 'bosch-demo',
    name: 'Bosch Island',
    community: 'Bosch Island',
    kind: 'Community',
    favorite: true,
    state: 'Living',
    species: 'Tyrannosaurus',
    growth: 83,
    code: '',
    photo: '',
  },
  {
    id: 'pieds-demo',
    name: 'Petits Pieds',
    community: 'Petits Pieds',
    kind: 'Community',
    favorite: true,
    state: 'No dinosaur',
    species: '',
    growth: 0,
    code: '',
    photo: '',
  },
  {
    id: 'official-eu1',
    name: 'EU1',
    community: 'The Isle Official',
    kind: 'Official',
    favorite: true,
    state: 'Dead',
    species: 'Omniraptor',
    growth: 100,
    code: '',
    photo: '',
  },
  {
    id: 'asura-demo',
    name: 'Asura',
    community: 'Asura',
    kind: 'Community',
    favorite: false,
    state: 'No dinosaur',
    species: '',
    growth: 0,
    code: '',
    photo: '',
  },
  {
    id: 'islander-i',
    name: 'Islander · Semi-Realism I',
    community: 'Islander',
    kind: 'Community',
    favorite: false,
    state: 'No dinosaur',
    species: '',
    growth: 0,
    code: '',
    photo: '',
  },
];
const speciesList = [
  'Ceratosaurus',
  'Omniraptor',
  'Carnotaurus',
  'Deinosuchus',
  'Diabloceratops',
  'Dilophosaurus',
  'Pteranodon',
  'Stegosaurus',
  'Tenontosaurus',
  'Tyrannosaurus',
];
export default function Garage({
  initialRecords,
  initialVersion,
  ownerName,
}: {
  initialRecords: Server[] | null;
  initialVersion: number;
  ownerName: string;
}) {
  const [servers, setServers] = useState<Server[]>(initialRecords || initial);
  const [legacy, setLegacy] = useState<Server[] | null>(null);
  const [saveState, setSaveState] = useState(
    initialRecords ? 'saved' : 'unsaved',
  );
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
      const records = currentServers.current;
      saveChain.current = saveChain.current.then(async () => {
        try {
          const response = await fetch('/api/garage', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ records, version: revision.current }),
          });
          const data = (await response.json()) as {
            error?: string;
            version: number;
            records: Server[];
          };
          if (!response.ok) throw new Error(data.error || 'Save failed');
          revision.current = data.version;
          if (currentServers.current === records) {
            setServers(data.records);
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
    setServers((old) => old.map((s) => (s.id === server.id ? server : s)));
  }
  function toggleFavorite(server: Server) {
    update({ ...server, favorite: !server.favorite });
  }
  function save() {
    if (!edit) return;
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
  const filtered = servers.filter(
    (s) =>
      (filter === 'All servers' || s.kind === filter) &&
      `${s.name} ${s.community}`.toLowerCase().includes(query.toLowerCase()),
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
            {s.state === 'Living' ? (
              <Feather />
            ) : s.state === 'Dead' ? (
              <Skull />
            ) : (
              <Plus />
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
            <h4>
              {s.species === 'Tyrannosaurus'
                ? 'T-Rex'
                : s.species || 'No dinosaur'}
            </h4>
            <span className="record-note">
              {s.state === 'No dinosaur'
                ? 'Ready for your next dinosaur.'
                : s.updated
                  ? 'Manually updated ' +
                    new Date(s.updated).toLocaleDateString()
                  : 'Sample record · try editing'}
            </span>
          </div>
          {s.state === 'Living' && (
            <div className="growth">
              <strong>
                {s.growth}
                <small>%</small>
              </strong>
              <span>GROWTH</span>
            </div>
          )}
        </div>
        {s.state === 'Living' && (
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
              <small>ChatGPT account</small>
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
                ? 'Saved privately'
                : saveState === 'saving'
                  ? 'Saving…'
                  : saveState === 'error'
                    ? 'Save failed — retry before sharing'
                    : 'Unsaved sample garage'}
              {(saveState === 'unsaved' || saveState === 'error') && (
                <button className="text-button" onClick={markChanged}>
                  {' '}
                  · Save garage
                </button>
              )}
            </div>
            {legacy && (
              <div className="migration-notice">
                Records from this browser are available. Import them into this
                ChatGPT account?
                <button
                  onClick={() => {
                    setServers(legacy);
                    markChanged();
                  }}
                >
                  Import browser records
                </button>
              </div>
            )}
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
                <button
                  className="icon-button"
                  aria-label="Preview shared garage"
                  onClick={() => setShare(true)}
                >
                  <Share2 size={18} />
                </button>
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
                  Curated preview directory · community preview instances are
                  illustrative.
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
              Private ChatGPT-owned records. Only lists you publish are public.
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
            {edit?.name} · manually tracked dinosaur
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
              <div className="growth-control">
                <label htmlFor="growth">
                  Growth{' '}
                  <input
                    id="growth"
                    type="number"
                    min={0}
                    max={100}
                    value={edit.growth}
                    onChange={(e) =>
                      setEdit({
                        ...edit,
                        growth: Math.max(
                          0,
                          Math.min(100, Number(e.target.value)),
                        ),
                      })
                    }
                  />{' '}
                  %
                </label>
                <Slider
                  aria-label="Dinosaur growth"
                  value={[edit.growth]}
                  onValueChange={(v) =>
                    setEdit({ ...edit, growth: Array.isArray(v) ? v[0] : v })
                  }
                />
              </div>
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
              <label className="upload">
                Screenshot{' '}
                <span className="optional">optional · up to 1 MB</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 1000000) {
                      // oxlint-disable-next-line react/react-compiler -- Surface an external storage failure.
                      setNotice('Choose an image under 1 MB.');
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = () =>
                      setEdit({
                        ...edit,
                        photo:
                          typeof reader.result === 'string'
                            ? reader.result
                            : '',
                      });
                    reader.readAsDataURL(file);
                  }}
                />
              </label>
              {edit.photo && (
                <div className="photo-preview">
                  <img src={edit.photo} alt="Your dinosaur screenshot" />
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Remove screenshot"
                    onClick={() => setEdit({ ...edit, photo: '' })}
                  >
                    <X size={16} />
                  </button>
                </div>
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
      <Dialog open={share} onOpenChange={setShare}>
        <DialogContent className="garage-dialog">
          <DialogTitle>Share your garage</DialogTitle>
          <DialogDescription>
            Publish selected records, then copy a stable link.
          </DialogDescription>
          <ShareManager
            servers={servers}
            saved={saveState === 'saved'}
            onSave={markChanged}
          />
        </DialogContent>
      </Dialog>
      <Dialog open={info} onOpenChange={setInfo}>
        <DialogContent className="garage-dialog">
          <DialogTitle>Operator session</DialogTitle>
          <DialogDescription>
            ChatGPT sign-in protects your garage while Steam integration is
            pending.
          </DialogDescription>
          <p>
            Try favoriting servers, parking a dinosaur, and updating its growth
            or skin. Records are saved privately to your ChatGPT account.
          </p>
          <p>
            Steam sign-in and automatic Discord message updates are planned
            integrations. No game account is connected.
          </p>
          <button className="primary-button" onClick={() => setInfo(false)}>
            Explore the garage <ArrowUpRight size={16} />
          </button>
        </DialogContent>
      </Dialog>
      {notice && <output className="notice">{notice}</output>}
    </main>
  );
}
