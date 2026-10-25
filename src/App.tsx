import { useCallback, useEffect, useRef, useState } from "react";
import {
  Map as MapIcon,
  Trophy,
  FolderOpen,
  Plus,
  ArrowUpRight,
  ArrowLeft,
  Search,
  X,
  Heart,
  WifiOff,
  Info,
  RefreshCw,
  Download,
} from "lucide-react";
import { ParisMap } from "./components/ParisMap";
import { Studio } from "./components/Studio";
import { ProposalView } from "./components/ProposalView";
import { PhotoCredit } from "./components/PhotoCredit";
import { api, readLocal, saveLocal, BASE } from "./api";
import type { Config, Draft, Proposal, Place } from "./types";
import initialPlaces from "../data/places.json";
import { STYLES } from "../worker/domain.js";
const initialConfig: Config = {
  places: initialPlaces,
  styles: STYLES.map(({ prompt, ...s }) => s),
  generationAvailable: false,
};
const defaultDraft: Draft = {
  placeId: "gare-de-lyon",
  styleId: "haussmannien",
  instructions: "",
  author: "",
  title: "",
};
export default function App() {
  const [config, setConfig] = useState<Config>(initialConfig),
    [draft, setDraftState] = useState<Draft>(() => ({
      ...defaultDraft,
      ...readLocal("lc-draft", {}),
    }));
  const [screen, setScreen] = useState<"map" | "studio" | "proposal">("map"),
    [tab, setTab] = useState<"map" | "ranking" | "mine">("map"),
    [selected, setSelected] = useState(draft.placeId),
    [picker, setPicker] = useState(false),
    [query, setQuery] = useState("");
  const [proposals, setProposals] = useState<Proposal[]>(() =>
      readLocal("lc-public", []),
    ),
    [mine, setMine] = useState<Proposal[]>([]),
    [votes, setVotes] = useState<string[]>([]),
    [current, setCurrent] = useState<Proposal | null>(null);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [live, setLive] = useState(false),
    [online, setOnline] = useState(navigator.onLine),
    [loading, setLoading] = useState(true),
    [info, setInfo] = useState(false),
    [intro, setIntro] = useState(() => !readLocal("lc-intro", false)),
    [install, setInstall] = useState<BeforeInstallPromptEvent | null>(null);
  const main = useRef<HTMLElement>(null),
    initialLink = useRef(false),
    refreshing = useRef(false);
  const setDraft = (next: Draft) => {
    setDraftState(next);
    saveLocal("lc-draft", next);
  };
  useEffect(() => {
    document.title =
      screen === "proposal" && current
        ? `${current.title} · Le Corbusier`
        : "Le Corbusier · Paris à l'ère de l'IA";
  }, [screen, current?.title]);
  const refresh = useCallback(async () => {
    if (refreshing.current) return;
    if (!navigator.onLine) {
      setLoading(false);
      return;
    }
    refreshing.current = true;
    try {
      const [publicData, mineData] = await Promise.all([
        api<{ proposals: Proposal[]; next: string | null }>("/proposals"),
        api<{ proposals: Proposal[]; votes: string[] }>("/mine"),
      ]);
      let list = publicData.proposals;
      let next = publicData.next;
      while (next) {
        const page = await api<{ proposals: Proposal[]; next: string | null }>(
          "/proposals?before=" + encodeURIComponent(next),
        );
        list = list.concat(page.proposals);
        next = page.next;
      }
      setProposals(list);
      saveLocal("lc-public", list);
      setMine(mineData.proposals);
      setVotes(mineData.votes);
      setError("");
      setCurrent((old) =>
        old
          ? mineData.proposals.find((p) => p.id === old.id) ||
            list.find((p) => p.id === old.id) ||
            old
          : null,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      refreshing.current = false;
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    api<Config>("/config")
      .then(setConfig)
      .catch(() =>
        setError(
          "Connexion impossible. Les photos restent disponibles ; réessaie pour créer.",
        ),
      );
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (initialLink.current) return;
    initialLink.current = true;
    const id =
      location.pathname.match(/\/lecorbusier\/p\/([a-f0-9-]{36})/)?.[1] ||
      readLocal<string | null>("lc-active", null);
    if (id)
      api<Proposal>("/proposals/" + id)
        .then((p) => {
          setCurrent(p);
          setSelected(p.place_id);
          setScreen("proposal");
        })
        .catch(() => {
          saveLocal("lc-active", null);
        });
  }, []);
  useEffect(() => {
    let ws: WebSocket | undefined,
      timer: ReturnType<typeof setTimeout> | undefined,
      stopped = false;
    function connect() {
      if (stopped || !navigator.onLine) return;
      ws = new WebSocket(
        `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}${BASE}/api/live`,
      );
      ws.onopen = () => {
        setLive(true);
        void refresh();
      };
      ws.onmessage = (e) => {
        try {
          if (JSON.parse(e.data).type === "changed") void refresh();
        } catch {}
      };
      ws.onerror = () => ws?.close();
      ws.onclose = () => {
        setLive(false);
        if (!stopped) timer = setTimeout(connect, 5000);
      };
    }
    const network = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) {
        void refresh();
        if (ws?.readyState !== WebSocket.OPEN) connect();
      }
    };
    const visible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    connect();
    window.addEventListener("online", network);
    window.addEventListener("offline", network);
    document.addEventListener("visibilitychange", visible);
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 20000);
    return () => {
      stopped = true;
      clearTimeout(timer);
      clearInterval(interval);
      ws?.close();
      window.removeEventListener("online", network);
      window.removeEventListener("offline", network);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [refresh]);
  useEffect(() => {
    if (
      !current ||
      !["queued", "planning", "generating"].includes(current.status)
    )
      return;
    const id = setInterval(
      () =>
        api<Proposal>("/proposals/" + current.id)
          .then(setCurrent)
          .catch(() => {}),
      2500,
    );
    return () => clearInterval(id);
  }, [current?.id, current?.status]);
  useEffect(() => {
    main.current?.focus();
  }, [screen, tab]);
  useEffect(() => {
    const listener = (e: Event) => {
      e.preventDefault();
      setInstall(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", listener);
    return () => window.removeEventListener("beforeinstallprompt", listener);
  }, []);
  useEffect(() => {
    const back = () => {
      const id = location.pathname.match(/\/p\/([a-f0-9-]{36})/)?.[1];
      if (id)
        api<Proposal>("/proposals/" + id)
          .then((p) => {
            setCurrent(p);
            setScreen("proposal");
          })
          .catch(() => setScreen("map"));
      else setScreen("map");
    };
    window.addEventListener("popstate", back);
    return () => window.removeEventListener("popstate", back);
  }, []);
  const place =
    config.places.find(
      (p) => p.id === (screen === "proposal" ? current?.place_id : selected),
    ) || config.places[0];
  const placeProposals = proposals.filter((p) => p.place_id === selected);
  function goMap() {
    setScreen("map");
    setCurrent(null);
    setError("");
    history.replaceState({}, "", BASE + "/");
  }
  function choose(id: string) {
    setSelected(id);
    setPicker(false);
    setTab("map");
    setIntro(false);
    saveLocal("lc-intro", true);
  }
  function start(placeId = selected) {
    setDraft({ ...draft, placeId });
    setError("");
    setScreen("studio");
    setIntro(false);
    saveLocal("lc-intro", true);
  }
  function open(p: Proposal) {
    setCurrent(p);
    setSelected(p.place_id);
    setError("");
    setScreen("proposal");
    if (p.published_at) history.pushState({}, "", `${BASE}/p/${p.id}`);
    else saveLocal("lc-active", p.id);
  }
  async function generate() {
    setBusy(true);
    setError("");
    const requestId = crypto.randomUUID();
    // Save the request before sending: a lost HTTP response never requires a second paid request.
    saveLocal("lc-active", requestId);
    try {
      await api("/generate", { ...draft, requestId });
      const p = await api<Proposal>("/proposals/" + requestId);
      setCurrent(p);
      setScreen("proposal");
      void refresh();
    } catch (e) {
      try {
        const p = await api<Proposal>("/proposals/" + requestId);
        setCurrent(p);
        setScreen("proposal");
      } catch {
        saveLocal("lc-active", null);
        setError((e as Error).message);
      }
    } finally {
      setBusy(false);
    }
  }
  async function vote(p: Proposal) {
    const result = await api<{ votes: number; voted: boolean }>(
      `/proposals/${p.id}/vote`,
      { voted: !votes.includes(p.id) },
    );
    setVotes((old) =>
      result.voted
        ? [...new Set([...old, p.id])]
        : old.filter((id) => id !== p.id),
    );
    setProposals((old) =>
      old.map((item) =>
        item.id === p.id ? { ...item, votes: result.votes } : item,
      ),
    );
    setCurrent((old) =>
      old?.id === p.id ? { ...old, votes: result.votes } : old,
    );
  }
  async function publish() {
    if (!current) return;
    await api(`/proposals/${current.id}/publish`, {});
    const p = await api<Proposal>("/proposals/" + current.id);
    setCurrent(p);
    history.replaceState({}, "", `${BASE}/p/${p.id}`);
    saveLocal("lc-active", null);
    await refresh();
  }
  function remix() {
    if (!current) return;
    setDraft({
      ...draft,
      placeId: current.place_id,
      styleId: current.style_id,
      title: "",
      instructions: current.instructions || "",
    });
    setSelected(current.place_id);
    setScreen("studio");
    setError("");
  }
  function card(p: Proposal, index?: number) {
    const loc = config.places.find((l) => l.id === p.place_id);
    return (
      <button className="proposal-row" key={p.id} onClick={() => open(p)}>
        {index !== undefined && (
          <span className="rank">{String(index + 1).padStart(2, "0")}</span>
        )}
        <img src={p.image || loc?.image} alt="" loading="lazy" />
        <span className="proposal-row-body">
          <strong>{p.title}</strong>
          <span>
            {loc?.name} · {p.author}
          </span>
          {!p.published_at && (
            <small>
              {p.status === "failed"
                ? "À reprendre"
                : p.status === "ready"
                  ? "Prêt à publier"
                  : "Chantier en cours"}
            </small>
          )}
        </span>
        {p.published_at ? (
          <span className="row-votes">
            <Heart size={15} />
            {p.votes}
          </span>
        ) : (
          <ArrowUpRight size={18} />
        )}
      </button>
    );
  }
  return (
    <main ref={main} tabIndex={-1} className={`app-shell screen-${screen}`}>
      {screen === "studio" ? (
        <Studio
          config={config}
          place={config.places.find((p) => p.id === draft.placeId) || place}
          draft={draft}
          setDraft={setDraft}
          onBack={goMap}
          onGenerate={() => void generate()}
          busy={busy}
          error={error}
        />
      ) : screen === "proposal" && current ? (
        <ProposalView
          key={current.id}
          proposal={current}
          place={place}
          style={config.styles.find((s) => s.id === current.style_id)}
          voted={votes.includes(current.id)}
          onBack={goMap}
          onVote={vote}
          onPublish={publish}
          onRemix={remix}
          onRefresh={() => {
            void api<Proposal>("/proposals/" + current.id)
              .then(setCurrent)
              .catch((e) => setError(e.message));
          }}
          error={error}
        />
      ) : (
        <>
          <header className="app-header">
            <a
              className="wordmark"
              href={BASE + "/"}
              onClick={(e) => {
                e.preventDefault();
                setTab("map");
              }}
            >
              Le Corbusier<span className="wordmark-dot">.</span>
            </a>
            <div className="header-actions">
              <span
                className="live-status"
                aria-label={
                  live
                    ? "Carte connectée en temps réel"
                    : "Reconnexion à la carte"
                }
              >
                <span className={live ? "connected" : ""} />
                {live ? "En direct" : "Connexion"}
              </span>
              <button
                className="icon-button"
                onClick={() => setInfo(true)}
                aria-label="À propos"
              >
                <Info size={19} />
              </button>
            </div>
          </header>
          <nav className="main-nav" aria-label="Navigation principale">
            {[
              { id: "map", text: "Carte", Icon: MapIcon },
              { id: "ranking", text: "Palmarès", Icon: Trophy },
              { id: "mine", text: "Mes plans", Icon: FolderOpen },
            ].map(({ id, text, Icon }) => (
              <button
                key={id}
                aria-current={tab === id ? "page" : undefined}
                className={tab === id ? "active" : ""}
                onClick={() => setTab(id as typeof tab)}
              >
                <Icon size={16} />
                {text}
                {id === "mine" && mine.some((p) => !p.published_at) && (
                  <span
                    className="unpublished-dot"
                    aria-label="Plans non publiés"
                  />
                )}
              </button>
            ))}
          </nav>
          {!online && (
            <div className="offline-note" role="status">
              <WifiOff size={16} />
              Hors ligne. Les photos consultées restent accessibles.
            </div>
          )}
          {tab === "map" ? (
            <div className="map-workspace">
              <ParisMap
                places={config.places}
                proposals={proposals}
                selected={selected}
                onSelect={choose}
                onProposal={open}
              />
              <button
                className="place-picker-button"
                onClick={() => setPicker(true)}
              >
                <Search size={16} />
                Choisir un lieu<span>{config.places.length}</span>
              </button>
              {intro && (
                <div className="intro-note">
                  <button
                    className="icon-button"
                    aria-label="Fermer l'introduction"
                    onClick={() => {
                      setIntro(false);
                      saveLocal("lc-intro", true);
                    }}
                  >
                    <X size={16} />
                  </button>
                  <p>
                    Tu es Le Corbusier.
                    <br />
                    Paris passe à l'IA. À toi de signer les plans.
                  </p>
                </div>
              )}
              <section className="location-sheet" aria-label={place.name}>
                <div className="sheet-grabber" aria-hidden="true" />
                <div className="location-main">
                  <button
                    className="location-photo-button"
                    onClick={() => setPicker(true)}
                    aria-label="Voir les lieux"
                  >
                    <img src={place.image} alt={place.name} />
                  </button>
                  <div>
                    <h1>{place.name}</h1>
                    <p>{place.arrondissement} arrondissement</p>
                    <button
                      className="text-button"
                      onClick={() => setPicker(true)}
                    >
                      Changer de lieu
                    </button>
                  </div>
                </div>
                {placeProposals.length > 0 && (
                  <div className="local-contributions">
                    <span>
                      {placeProposals.length} proposition
                      {placeProposals.length > 1 ? "s" : ""}
                    </span>
                    <div>
                      {placeProposals.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => open(p)}
                          aria-label={p.title}
                        >
                          <img src={p.image} alt={p.title} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <button
                  className="primary-button"
                  disabled={!config.generationAvailable || !online}
                  onClick={() => start()}
                >
                  <Plus size={19} />
                  Dessiner ici
                </button>
                {!config.generationAvailable && (
                  <p className="quiet-note">
                    {loading
                      ? "Connexion au chantier..."
                      : "Génération indisponible. "}
                    <button
                      className="text-button"
                      onClick={() =>
                        api<Config>("/config")
                          .then(setConfig)
                          .catch(() => {})
                      }
                    >
                      Réessayer
                    </button>
                  </p>
                )}
              </section>
            </div>
          ) : (
            <section className="collection-page">
              <div className="collection-title">
                <div>
                  <span className="eyebrow">
                    {tab === "ranking" ? "Le goût des autres" : "Ton agence"}
                  </span>
                  <h1>
                    {tab === "ranking" ? "Le permis de plaire." : "Mes plans"}
                  </h1>
                </div>
                <button
                  className="icon-button"
                  onClick={() => void refresh()}
                  aria-label="Actualiser"
                >
                  <RefreshCw size={18} />
                </button>
              </div>
              {loading ? (
                <p role="status" className="empty-message">
                  Ouverture des dossiers...
                </p>
              ) : (tab === "ranking" ? proposals : mine).length === 0 ? (
                <div className="empty-state">
                  <span className="empty-drawing" aria-hidden="true">
                    {tab === "ranking" ? (
                      <Trophy size={34} />
                    ) : (
                      <FolderOpen size={34} />
                    )}
                  </span>
                  <h2>
                    {tab === "ranking"
                      ? "Le jury attend ton bâtiment."
                      : "Aucun chantier à ton nom."}
                  </h2>
                  <p>
                    {tab === "ranking"
                      ? "Publie une proposition. Les visiteurs voteront pour leurs préférées."
                      : "Tes créations restent ici, même avant publication, dans ce navigateur."}
                  </p>
                  <button
                    className="primary-button"
                    onClick={() => {
                      setTab("map");
                      setPicker(true);
                    }}
                  >
                    Choisir un lieu
                    <ArrowUpRight size={18} />
                  </button>
                </div>
              ) : (
                <div className="proposal-list">
                  {(tab === "ranking"
                    ? [...proposals].sort(
                        (a, b) =>
                          b.votes - a.votes ||
                          (b.published_at || 0) - (a.published_at || 0),
                      )
                    : mine
                  ).map((p, i) => card(p, tab === "ranking" ? i : undefined))}
                </div>
              )}
              {tab === "ranking" && proposals.length > 0 && (
                <p className="collection-footnote">
                  Un vote par création et par navigateur. Tu peux changer
                  d'avis.
                </p>
              )}
            </section>
          )}
          {error && (
            <div className="connection-error" role="alert">
              <span>{error}</span>
              <button onClick={() => void refresh()} className="text-button">
                Réessayer
              </button>
            </div>
          )}
        </>
      )}
      {picker && (
        <div className="overlay" onClick={() => setPicker(false)}>
          <section
            className="place-picker modal-surface"
            role="dialog"
            aria-modal="true"
            aria-label="Choisir un lieu"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={trapFocus}
          >
            <header className="page-header">
              <h2>Où poser les serveurs ?</h2>
              <button
                className="icon-button"
                onClick={() => setPicker(false)}
                aria-label="Fermer"
              >
                <X />
              </button>
            </header>
            <label className="search-field">
              <Search size={18} />
              <input
                autoFocus
                type="search"
                placeholder="Un monument, un quartier..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Rechercher un lieu"
              />
            </label>
            <div className="places-list">
              {config.places
                .filter((p) =>
                  normalize(p.name + " " + p.arrondissement).includes(
                    normalize(query),
                  ),
                )
                .map((p) => (
                  <button
                    className={`place-row ${selected === p.id ? "selected" : ""}`}
                    key={p.id}
                    onClick={() => choose(p.id)}
                  >
                    <img src={p.image} alt="" loading="lazy" />
                    <span>
                      <strong>{p.name}</strong>
                      <small>{p.arrondissement} arrondissement</small>
                    </span>
                    <ArrowUpRight size={18} />
                  </button>
                ))}
            </div>
          </section>
        </div>
      )}
      {info && (
        <div className="overlay" onClick={() => setInfo(false)}>
          <section
            className="about modal-surface"
            role="dialog"
            aria-modal="true"
            aria-label="À propos de Le Corbusier"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={trapFocus}
          >
            <header className="page-header">
              <h2>Paris, à ta charge.</h2>
              <button
                autoFocus
                className="icon-button"
                onClick={() => setInfo(false)}
                aria-label="Fermer"
              >
                <X />
              </button>
            </header>
            <div className="about-body">
              <p>
                Choisis un vrai lieu de Paris, dessine un data center et signe
                les plans. Publie ta proposition pour la voir sur la carte
                commune.
              </p>
              <p>
                Le bâtiment doit montrer son usage : serveurs, ventilation,
                refroidissement. Le monument reste reconnaissable.
              </p>
              <p>
                Les photos de départ sont réelles. Les constructions sont
                fictives, générées avec OpenAI. Ce jeu satirique n'est lié ni à
                la Fondation Le Corbusier ni à la Ville de Paris.
              </p>
              <p>
                Pas de compte. Un identifiant anonyme enregistré dans ce
                navigateur retrouve tes plans et tes votes. Ton nom et le nom de
                ta création deviennent publics si tu publies.
              </p>
              {install ? (
                <button
                  className="secondary-button"
                  onClick={async () => {
                    await install.prompt();
                    setInstall(null);
                  }}
                >
                  <Download size={17} />
                  Installer l'app
                </button>
              ) : (
                <p>Sur iPhone : Partager, puis « Sur l'écran d'accueil ».</p>
              )}
              <a
                className="text-button"
                href="https://github.com/kennethassogba/lecorbusier"
                target="_blank"
                rel="noreferrer"
              >
                Code source
                <ArrowUpRight size={15} />
              </a>
              <details>
                <summary>Photos et licences</summary>
                {config.places.map((p) => (
                  <PhotoCredit key={p.id} place={p} />
                ))}
              </details>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
function normalize(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
function trapFocus(e: React.KeyboardEvent<HTMLElement>) {
  if (e.key === "Escape") {
    const close = e.currentTarget.querySelector<HTMLButtonElement>(
      '[aria-label="Fermer"]',
    );
    close?.click();
    return;
  }
  if (e.key !== "Tab") return;
  const els = Array.from(
    e.currentTarget.querySelectorAll<HTMLElement>(
      "button,input,a[href],textarea,summary",
    ),
  ).filter((el) => el.offsetParent !== null && !el.hasAttribute("disabled"));
  const first = els[0],
    last = els.at(-1);
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last?.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first?.focus();
  }
}
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
