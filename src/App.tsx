import { AnimatePresence } from "motion/react";
import { t, useLanguage, setLanguage } from "./i18n";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  Download,
  Heart,
  LoaderCircle,
  MoreHorizontal,
  Map as MapInfoIcon,
  Plus,
  Search,
  Share2,
  Smartphone,
  Trophy,
  UserRound,
  WifiOff,
  X,
} from "lucide-react";
import { ParisMap, type MapControl } from "./components/ParisMap";
import { Welcome } from "./components/Welcome";
import { Studio } from "./components/Studio";
import { ProposalView } from "./components/ProposalView";
import { PhotoCredit } from "./components/PhotoCredit";
import { Sheet } from "./components/Sheet";
import { Modal } from "./components/Modal";
import { SharePanel } from "./components/SharePanel";
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
type Panel =
  | "welcome"
  | "none"
  | "place"
  | "studio"
  | "proposal"
  | "search"
  | "collection";
type Filter = "all" | "top" | "mine";
const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export default function App() {
  const language = useLanguage();
  const [config, setConfig] = useState<Config>(initialConfig),
    [draft, setDraftState] = useState<Draft>(() => ({
      ...defaultDraft,
      ...readLocal("lc-draft", {}),
    }));
  const [panel, setPanel] = useState<Panel>(() =>
      !readLocal("lc-welcome-v1", false) &&
      !location.pathname.includes("/p/") &&
      !new URLSearchParams(location.search).has("build") &&
      !new URLSearchParams(location.search).has("view")
        ? "welcome"
        : "none",
    ),
    [filter, setFilter] = useState<Filter>("all"),
    [selected, setSelected] = useState<string | null>(null),
    [building, setBuilding] = useState(
      new URLSearchParams(location.search).has("build"),
    ),
    [query, setQuery] = useState("");
  const [proposals, setProposals] = useState<Proposal[]>(() =>
      readLocal("lc-public", []),
    ),
    [mine, setMine] = useState<Proposal[]>([]),
    [votes, setVotes] = useState<string[]>([]),
    [current, setCurrent] = useState<Proposal | null>(null);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [online, setOnline] = useState(navigator.onLine),
    [loading, setLoading] = useState(true),
    [menu, setMenu] = useState(false),
    [shareApp, setShareApp] = useState(false),
    [installHelp, setInstallHelp] = useState(false),
    [install, setInstall] = useState<BeforeInstallPromptEvent | null>(null),
    [installed, setInstalled] = useState(
      () =>
        matchMedia("(display-mode: standalone)").matches ||
        !!(navigator as Navigator & { standalone?: boolean }).standalone,
    ),
    [notice, setNotice] = useState<Proposal | null>(null),
    [previewPlace, setPreviewPlace] = useState<Place | null>(null);
  const [customPlaces, setCustomPlaces] = useState<Place[]>(() =>
    readLocal("lc-places", []),
  );
  const [searchResults, setSearchResults] = useState<Place[]>([]),
    [searching, setSearching] = useState(false),
    [searchError, setSearchError] = useState("");
  const [locating, setLocating] = useState(false);
  useEffect(() => {
    if (panel === "welcome") saveLocal("lc-welcome-v1", true);
  }, [panel]);
  const locationRequest = useRef(0);
  const places = useMemo(
    () => [
      ...new Map(
        [
          ...config.places,
          ...customPlaces,
          ...proposals.flatMap((p) => (p.place ? [p.place] : [])),
          ...mine.flatMap((p) => (p.place ? [p.place] : [])),
          ...(current?.place ? [current.place] : []),
          ...(draft.location ? [draft.location] : []),
        ].map((p) => [p.id, p]),
      ).values(),
    ],
    [
      config.places,
      customPlaces,
      proposals,
      mine,
      current?.place,
      draft.location,
    ],
  );
  const placesRef = useRef(places);
  placesRef.current = places;
  useEffect(() => {
    setSearchResults([]);
    setSearchError("");
    if (panel !== "search" || query.trim().length < 3) {
      setSearching(false);
      return;
    }
    setSearching(true);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void api<{ places: Place[] }>(
        "/search?q=" + encodeURIComponent(query),
        undefined,
        controller.signal,
      )
        .then((r) => {
          if (!controller.signal.aborted) setSearchResults(r.places);
        })
        .catch((e) => {
          if (!controller.signal.aborted) setSearchError(e.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false);
        });
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, panel]);
  const mapControl = useRef<MapControl | null>(null),
    refreshing = useRef(false),
    initialLink = useRef(false),
    root = useRef<HTMLElement>(null),
    known = useRef<Map<string, string> | null>(null);
  const setDraft = (d: Draft) => {
    setDraftState(d);
    saveLocal("lc-draft", d);
  };
  const refresh = useCallback(async () => {
    if (refreshing.current || !navigator.onLine) {
      setLoading(false);
      return;
    }
    refreshing.current = true;
    try {
      const [pub, own] = await Promise.all([
        api<{ proposals: Proposal[]; next: string | null }>("/proposals"),
        api<{ proposals: Proposal[]; votes: string[] }>("/mine"),
      ]);
      let list = pub.proposals,
        next = pub.next;
      while (next) {
        const page = await api<{ proposals: Proposal[]; next: string | null }>(
          "/proposals?before=" + encodeURIComponent(next),
        );
        list = list.concat(page.proposals);
        next = page.next;
      }
      setProposals((old) =>
        JSON.stringify(old) === JSON.stringify(list) ? old : list,
      );
      saveLocal("lc-public", list);
      setMine((old) =>
        JSON.stringify(old) === JSON.stringify(own.proposals)
          ? old
          : own.proposals,
      );
      setVotes(own.votes);
      setError((old) => (old === t("Connexion perdue. Réessaie.") ? "" : old));
      if (known.current) {
        const ready = own.proposals.find(
          (p) =>
            p.status === "ready" &&
            known.current?.has(p.id) &&
            known.current.get(p.id) !== "ready",
        );
        if (ready) setNotice(ready);
      }
      known.current = new Map(own.proposals.map((p) => [p.id, p.status]));
      const badge = navigator as Navigator & {
        setAppBadge?: (n: number) => Promise<void>;
        clearAppBadge?: () => Promise<void>;
      };
      const count = own.proposals.filter(
        (p) => p.status === "ready" && !p.published_at,
      ).length;
      if (count) void badge.setAppBadge?.(count).catch(() => {});
      else void badge.clearAppBadge?.().catch(() => {});
      setCurrent((old) =>
        old
          ? own.proposals.find((p) => p.id === old.id) ||
            list.find((p) => p.id === old.id) ||
            old
          : null,
      );
    } catch {
      setError(t("Connexion perdue. Réessaie."));
    } finally {
      refreshing.current = false;
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void api<Config>("/config")
      .then(setConfig)
      .catch(() => {});
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (initialLink.current) return;
    initialLink.current = true;
    // A reload reconstructs the screen from the URL, not an older panel snapshot.
    history.replaceState(
      {
        lc: {
          panel,
          selected: null,
          filter: "all",
          building: false,
          depth: 0,
        },
      },
      "",
    );
    const id = location.pathname.match(/\/p\/([a-f0-9-]{36})/)?.[1];
    if (id)
      history.replaceState(
        {
          lc: {
            panel: "proposal",
            currentId: id,
            filter: "all",
            building: false,
            depth: 0,
          },
        },
        "",
      );
    if (id)
      void api<Proposal>("/proposals/" + id)
        .then((p) => {
          setCurrent(p);
          setSelected(p.place_id);
          setPanel("proposal");
          const loc =
            p.place || placesRef.current.find((l) => l.id === p.place_id);
          if (loc) mapControl.current?.focus(loc);
        })
        .catch(() => setError(t("Création introuvable. Reviens à la carte.")));
    const shortcut = new URLSearchParams(location.search).get("view");
    if (shortcut === "mine" || shortcut === "top") {
      setFilter(shortcut);
      setPanel("collection");
      history.replaceState(
        { lc: { panel: "collection", filter: shortcut, depth: 0 } },
        "",
      );
    }
  }, []);
  useEffect(() => {
    let ws: WebSocket | undefined,
      timer: ReturnType<typeof setTimeout> | undefined,
      stopped = false;
    const connect = () => {
      if (
        stopped ||
        !navigator.onLine ||
        ws?.readyState === WebSocket.OPEN ||
        ws?.readyState === WebSocket.CONNECTING
      )
        return;
      clearTimeout(timer);
      ws = new WebSocket(
        `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}${BASE}/api/live`,
      );
      ws.onopen = () => void refresh();
      ws.onmessage = (e) => {
        try {
          if (JSON.parse(e.data).type === "changed") void refresh();
        } catch {}
      };
      ws.onerror = () => ws?.close();
      ws.onclose = () => {
        if (!stopped) timer = setTimeout(connect, 5000);
      };
    };
    const network = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) {
        void api<Config>("/config")
          .then(setConfig)
          .catch(() => {});
        void refresh();
        connect();
      }
    };
    const visible = () => {
      if (document.visibilityState === "visible") {
        void refresh();
        connect();
      }
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
    const timer = setInterval(
      () =>
        void api<Proposal>("/proposals/" + current.id)
          .then(setCurrent)
          .catch(() => {}),
      2500,
    );
    return () => clearInterval(timer);
  }, [current?.id, current?.status]);
  useEffect(() => {
    document.title =
      panel === "proposal" && current
        ? `${current.title} · Le Corbusier`
        : "Le Corbusier";
  }, [panel, current?.title]);
  useEffect(() => {
    const before = (e: Event) => {
      e.preventDefault();
      setInstall(e as BeforeInstallPromptEvent);
    };
    const added = () => {
      setInstalled(true);
      setInstall(null);
      setInstallHelp(false);
    };
    window.addEventListener("beforeinstallprompt", before);
    window.addEventListener("appinstalled", added);
    return () => {
      window.removeEventListener("beforeinstallprompt", before);
      window.removeEventListener("appinstalled", added);
    };
  }, []);
  useEffect(() => {
    const back = () => {
      const saved = history.state?.lc;
      const id =
        location.pathname.match(/\/p\/([a-f0-9-]{36})/)?.[1] ||
        saved?.currentId;
      setQuery("");
      setError("");
      setFilter(saved?.filter || "all");
      setBuilding(saved?.building || false);
      if (id && (!saved || saved.panel === "proposal"))
        void api<Proposal>("/proposals/" + id)
          .then((p) => {
            setCurrent(p);
            setSelected(p.place_id);
            setPanel("proposal");
            const loc =
              p.place || placesRef.current.find((l) => l.id === p.place_id);
            if (loc) mapControl.current?.focus(loc);
          })
          .catch(() => setPanel("none"));
      else {
        setPanel(saved?.panel || "none");
        setSelected(saved?.selected || null);
        const loc = placesRef.current.find((l) => l.id === saved?.selected);
        if (loc) mapControl.current?.focus(loc);
      }
    };
    window.addEventListener("popstate", back);
    return () => window.removeEventListener("popstate", back);
  }, []);
  // Keep floating map controls and attributions clear of every panel, including keyboard resize.
  useEffect(() => {
    if (!root.current) return;
    const sheet = root.current.querySelector(".map-sheet:not([data-exiting])");
    const update = () =>
      root.current?.style.setProperty(
        "--panel-height",
        sheet
          ? `${Math.max(0, Math.min(sheet.getBoundingClientRect().height, (root.current?.getBoundingClientRect().bottom || innerHeight) - sheet.getBoundingClientRect().top))}px`
          : "0px",
      );
    const ro = new ResizeObserver(update);
    if (sheet) ro.observe(sheet);
    update();
    return () => ro.disconnect();
  }, [panel, selected, current?.id]);
  useEffect(() => {
    const viewport = window.visualViewport;
    const resize = () =>
      root.current?.style.setProperty(
        "--app-height",
        `${viewport?.height || window.innerHeight}px`,
      );
    resize();
    viewport?.addEventListener("resize", resize);
    return () => viewport?.removeEventListener("resize", resize);
  }, []);
  const place =
    places.find(
      (p) => p.id === (panel === "proposal" ? current?.place_id : selected),
    ) || config.places[0];
  const ranked = [...proposals].sort(
    (a, b) =>
      b.votes + (b.demo_votes || 0) - (a.votes + (a.demo_votes || 0)) ||
      (b.published_at || 0) - (a.published_at || 0),
  );
  const visible =
    filter === "mine" ? mine : filter === "top" ? ranked : proposals;
  const mapProposals =
    filter === "mine" ? mine.filter((p) => p.published_at) : proposals;
  function remember(
    next: Panel,
    id: string | null = null,
    f: Filter = filter,
    build = false,
    p?: Proposal,
  ) {
    history.pushState(
      {
        lc: {
          panel: next,
          selected: id,
          filter: f,
          building: build,
          currentId: p?.id,
          depth: (history.state?.lc?.depth || 0) + 1,
        },
      },
      "",
      p?.published_at ? `${BASE}/p/${p.id}` : BASE + "/",
    );
  }
  function close() {
    locationRequest.current++;
    setLocating(false);
    setPanel("none");
    setSelected(null);
    setQuery("");
    setError("");
    setBuilding(false);
    const depth = history.state?.lc?.depth || 0;
    if (depth) history.go(-depth);
    else
      history.replaceState({ lc: { panel: "none", depth: 0 } }, "", BASE + "/");
  }
  function choose(value: string | Place) {
    locationRequest.current++;
    setLocating(false);
    const p =
      typeof value === "string" ? places.find((p) => p.id === value) : value;
    if (!p) return;
    if (p.referenceKind === "aerial")
      setCustomPlaces((old) => {
        const next = [...old.filter((item) => item.id !== p.id), p].slice(-60);
        saveLocal("lc-places", next);
        return next;
      });
    (document.activeElement as HTMLElement)?.blur?.();
    remember("place", p.id);
    setSelected(p.id);
    setPanel("place");
    setBuilding(false);
    setQuery("");
    setError("");
    mapControl.current?.focus(p);
  }
  async function pick(point: { lng: number; lat: number }) {
    const sequence = ++locationRequest.current;
    setLocating(true);
    setError("");
    try {
      const p = await api<Place>(`/place?lat=${point.lat}&lng=${point.lng}`);
      if (sequence === locationRequest.current) choose(p);
    } catch (e) {
      if (sequence === locationRequest.current) setError((e as Error).message);
    } finally {
      if (sequence === locationRequest.current) setLocating(false);
    }
  }
  function open(p: Proposal) {
    locationRequest.current++;
    setLocating(false);
    remember("proposal", p.place_id, filter, false, p);
    setCurrent(p);
    setSelected(p.place_id);
    setPanel("proposal");
    setBuilding(false);
    setQuery("");
    setNotice(null);
    setError("");
    const loc = p.place || places.find((l) => l.id === p.place_id);
    if (loc) mapControl.current?.focus(loc);
  }
  function start() {
    remember("studio", place.id);
    setDraft({
      ...draft,
      placeId: place.id,
      location: place.referenceKind === "aerial" ? place : undefined,
    });
    setPanel("studio");
    setBuilding(false);
    setError("");
  }
  function add() {
    locationRequest.current++;
    setLocating(false);
    remember("none", null, "all", true);
    setBuilding(true);
    setPanel("none");
    setSelected(null);
    setFilter("all");
    mapControl.current?.home();
  }
  async function generate() {
    setBusy(true);
    setError("");
    const requestId = crypto.randomUUID();
    saveLocal("lc-active", requestId);
    try {
      await api("/generate", { ...draft, requestId, language });
      const p = await api<Proposal>("/proposals/" + requestId);
      open(p);
      void refresh();
    } catch (e) {
      try {
        open(await api<Proposal>("/proposals/" + requestId));
      } catch {
        saveLocal("lc-active", null);
        setError((e as Error).message);
      }
    } finally {
      setBusy(false);
    }
  }
  async function vote(p: Proposal) {
    const r = await api<{ votes: number; voted: boolean }>(
      `/proposals/${p.id}/vote`,
      { voted: !votes.includes(p.id) },
    );
    setVotes((old) =>
      r.voted ? [...new Set([...old, p.id])] : old.filter((id) => id !== p.id),
    );
    setProposals((old) =>
      old.map((item) =>
        item.id === p.id ? { ...item, votes: r.votes } : item,
      ),
    );
    setCurrent((old) => (old?.id === p.id ? { ...old, votes: r.votes } : old));
  }
  async function publish() {
    if (!current) return;
    await api(`/proposals/${current.id}/publish`, {});
    const p = await api<Proposal>("/proposals/" + current.id);
    setCurrent(p);
    history.replaceState(history.state, "", `${BASE}/p/${p.id}`);
    saveLocal("lc-active", null);
    await refresh();
  }
  function remix() {
    if (!current) return;
    remember("studio", current.place_id);
    setDraft({
      ...draft,
      placeId: current.place_id,
      location: current.place,
      styleId: current.style_id,
      title: "",
      instructions: current.instructions || "",
    });
    setSelected(current.place_id);
    setPanel("studio");
  }
  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Le Corbusier",
          url: location.origin + BASE + "/",
        });
      } catch (e) {
        if ((e as Error).name !== "AbortError") setShareApp(true);
      }
    } else setShareApp(true);
  }
  async function installApp() {
    setMenu(false);
    if (install) {
      await install.prompt();
      const choice = await install.userChoice;
      setInstall(null);
      if (choice.outcome === "accepted") setInstalled(true);
    } else setInstallHelp(true);
  }
  function collection(f: Filter) {
    locationRequest.current++;
    setLocating(false);
    if (f === "all") {
      close();
      setFilter("all");
      return;
    }
    remember("collection", null, f);
    setFilter(f);
    setSelected(null);
    setBuilding(false);
    setPanel("collection");
  }
  function card(p: Proposal, index?: number, subtitle?: string) {
    const loc = p.place || places.find((l) => l.id === p.place_id);
    return (
      <button className="creation-card" key={p.id} onClick={() => open(p)}>
        {index !== undefined && <span className="rank">{index + 1}</span>}
        <span className="creation-print">
          <img src={p.image || loc?.image} alt="" loading="lazy" />
        </span>
        <span className="creation-card-info">
          <strong>{p.title}</strong>
          <span className="builder-name">{p.author}</span>
          <span>{subtitle || t(loc?.name || "")}</span>
        </span>
        {p.published_at ? (
          <span className="card-votes">
            <Heart size={14} />
            {(p.votes + (p.demo_votes || 0))
              .toLocaleString(language === "fr" ? "fr-FR" : "en-GB")
              .replace(/\u202f|\u00a0/g, " ")}
          </span>
        ) : (
          <span className="card-status">
            {p.status === "ready" ? (
              <Check size={16} />
            ) : p.status === "failed" ? (
              <RotateIcon />
            ) : (
              <LoaderCircle size={16} className="spin" />
            )}
          </span>
        )}
      </button>
    );
  }
  return (
    <main
      ref={root}
      className={`app-shell panel-${panel} ${building ? "building-mode" : ""}`}
    >
      <ParisMap
        places={places.filter(
          (p) =>
            !p.referenceKind ||
            p.id === selected ||
            mapProposals.some((c) => c.place_id === p.id),
        )}
        proposals={mapProposals}
        selected={selected}
        building={building}
        onSelect={choose}
        onProposal={open}
        onBlank={(point) => {
          if (point && ["none", "place", "welcome"].includes(panel))
            void pick(point);
          else if (!point && panel === "place") close();
        }}
        control={mapControl}
      />
      <header className="map-header">
        <div className="search-bar">
          <Search size={20} aria-hidden="true" />
          <input
            type="search"
            aria-label={t("Rechercher à Paris")}
            placeholder={t("Lieu ou adresse à Paris")}
            value={query}
            onFocus={() => {
              locationRequest.current++;
              setLocating(false);
              if (panel !== "search") remember("search");
              setPanel("search");
            }}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.currentTarget.blur();
                close();
              }
            }}
          />
          <button
            className="icon-button"
            aria-label={t("Partager l'app")}
            onClick={() => void share()}
          >
            <Share2 size={20} />
          </button>
          <button
            className="icon-button"
            aria-label={t("Menu de l'app")}
            onClick={() => setMenu(true)}
          >
            <MoreHorizontal size={22} />
          </button>
        </div>
        <nav className="map-filters" aria-label={t("Créations sur la carte")}>
          <button
            aria-pressed={filter === "all"}
            onClick={() => collection("all")}
          >
            {t("Tout")}
          </button>
          <button
            aria-pressed={filter === "top"}
            onClick={() => collection("top")}
          >
            <Trophy size={15} />
            {t("Top")}
          </button>
          <button
            aria-pressed={filter === "mine"}
            onClick={() => collection("mine")}
          >
            <UserRound size={15} />
            {t("Les miens")}
            {mine.some((p) => !p.published_at) && (
              <span
                className="pending-dot"
                aria-label={t("Créations en cours")}
              />
            )}
          </button>
        </nav>
      </header>
      {building && panel === "none" && (
        <div className="map-crosshair" aria-hidden="true">
          <span />
        </div>
      )}
      {locating && !building && (
        <div className="location-status" role="status">
          <LoaderCircle className="spin" size={18} />
          {t("Localisation...")}
        </div>
      )}
      {!online && (
        <div className="network-state" role="status">
          <WifiOff size={15} />
          {t("Hors ligne")}
        </div>
      )}
      {panel === "none" && (
        <>
          {building ? (
            <div className="build-prompt">
              <button
                className="place-center"
                onClick={() => {
                  const point = mapControl.current?.center();
                  if (point) void pick(point);
                }}
                disabled={locating}
              >
                {locating ? (
                  <LoaderCircle className="spin" size={19} />
                ) : (
                  <Plus size={20} />
                )}{" "}
                {t("Construire ici")}
              </button>
              <button
                className="icon-button"
                aria-label={t("Annuler")}
                onClick={close}
              >
                <X size={20} />
              </button>
            </div>
          ) : (
            <div className="explore-bottom">
              <button className="build-button" onClick={add}>
                <Plus size={24} />
                {t("Construire")}
              </button>
              {visible.length > 0 && (
                <div
                  className="discovery-rail"
                  aria-label={t("Créations récentes")}
                >
                  {visible.slice(0, 30).map((p) => card(p))}
                </div>
              )}
            </div>
          )}
        </>
      )}
      <AnimatePresence initial={false}>
        {panel === "welcome" && (
          <Welcome
            key="welcome"
            place={config.places.find((p) => p.id === "louvre")!}
            onBuild={add}
            onClose={close}
          />
        )}
        {panel === "place" && (
          <Sheet
            key="place"
            label={t(place.name)}
            kind="place-sheet"
            onClose={close}
          >
            <div className="place-heading">
              <button
                className="place-photo"
                aria-label={t("Voir {lieu}", { lieu: t(place.name) })}
                onClick={() => setPreviewPlace(place)}
              >
                <img src={place.image} alt="" />
              </button>
              <div>
                <h1>{t(place.name)}</h1>
                <span>{t(place.arrondissement)} · Paris</span>
              </div>
              <button
                className="icon-button"
                aria-label={t("Fermer le lieu")}
                onClick={close}
              >
                <X size={20} />
              </button>
            </div>
            {proposals.some((p) => p.place_id === place.id) && (
              <div className="sheet-scroll local-creations">
                {proposals
                  .filter((p) => p.place_id === place.id)
                  .map((p) =>
                    card(
                      p,
                      undefined,
                      t(
                        config.styles.find((s) => s.id === p.style_id)?.name ||
                          "",
                      ),
                    ),
                  )}
              </div>
            )}
            <footer className="sheet-footer">
              <button
                className="primary-button"
                onClick={start}
                disabled={!online || !config.generationAvailable}
              >
                <Plus size={20} />
                {t("Construire ici")}
              </button>
              {online && !config.generationAvailable && (
                <button
                  className="text-button"
                  onClick={() =>
                    void api<Config>("/config")
                      .then(setConfig)
                      .catch(() => setError(t("Connexion perdue. Réessaie.")))
                  }
                >
                  {loading ? t("Connexion...") : t("Réessayer")}
                </button>
              )}
            </footer>
          </Sheet>
        )}
        {panel === "studio" && (
          <Studio
            key="studio"
            config={config}
            place={places.find((p) => p.id === draft.placeId) || place}
            draft={draft}
            setDraft={setDraft}
            onBack={() => {
              if (history.state?.lc?.depth) history.back();
              else setPanel("place");
            }}
            onGenerate={() => void generate()}
            busy={busy}
            error={error}
          />
        )}
        {panel === "proposal" && current && (
          <ProposalView
            key={"proposal-" + current.id}
            proposal={current}
            place={place}
            voted={votes.includes(current.id)}
            onBack={close}
            onVote={vote}
            onPublish={publish}
            onRemix={remix}
            error={error}
          />
        )}
        {panel === "search" && (
          <Sheet
            label={t("Rechercher à Paris")}
            key="search"
            kind="search-sheet"
            onClose={close}
            autoFocus={false}
          >
            <header className="sheet-header">
              <h1>{t("Lieux")}</h1>
              <button
                className="icon-button"
                aria-label={t("Fermer la recherche")}
                onClick={close}
              >
                <X size={20} />
              </button>
            </header>
            <div className="sheet-scroll places-list">
              {query &&
                proposals
                  .filter((p) =>
                    normalize(p.title + " " + p.author).includes(
                      normalize(query),
                    ),
                  )
                  .map((p) => card(p))}
              {config.places
                .filter((p) =>
                  normalize(
                    p.name + " " + t(p.name) + " " + p.arrondissement,
                  ).includes(normalize(query)),
                )
                .map((p) => (
                  <button
                    className="place-row"
                    key={p.id}
                    onClick={() => choose(p)}
                  >
                    <img src={p.image} alt="" loading="lazy" />
                    <span>
                      <strong>{t(p.name)}</strong>
                      <small>{t(p.arrondissement)}</small>
                    </span>
                    <ChevronRight size={18} />
                  </button>
                ))}
              {searchResults
                .filter(
                  (p) =>
                    !config.places.some(
                      (c) => normalize(c.name) === normalize(p.name),
                    ),
                )
                .map((p) => (
                  <button
                    className="place-row address-row"
                    key={p.id}
                    onClick={() => choose(p)}
                  >
                    <span className="address-icon">
                      <Search size={20} />
                    </span>
                    <span>
                      <strong>{t(p.name)}</strong>
                      <small>{t("Paris")}</small>
                    </span>
                    <ChevronRight size={18} />
                  </button>
                ))}
              {searching && (
                <div className="search-status" role="status">
                  <LoaderCircle className="spin" size={18} />
                  {t("Recherche...")}
                </div>
              )}
              {searchError && (
                <div className="error-message" role="alert">
                  {t(searchError)}
                  <button className="text-button" onClick={add}>
                    {t("Choisir sur la carte")}
                  </button>
                </div>
              )}
              {query.length >= 3 &&
                !searching &&
                !searchError &&
                !searchResults.length &&
                !config.places.some((p) =>
                  normalize(p.name + " " + t(p.name)).includes(
                    normalize(query),
                  ),
                ) &&
                !proposals.some((p) =>
                  normalize(p.title + " " + p.author).includes(
                    normalize(query),
                  ),
                ) && (
                  <div className="empty-state">
                    <span>{t("Aucun résultat dans Paris")}</span>
                    <button className="text-button" onClick={add}>
                      {t("Choisir sur la carte")}
                    </button>
                  </div>
                )}
            </div>
          </Sheet>
        )}
        {panel === "collection" && (
          <Sheet
            key="collection"
            label={filter === "top" ? t("Top") : t("Mes créations")}
            kind="collection-sheet"
            onClose={close}
          >
            <header className="sheet-header">
              <h1>{filter === "top" ? t("Top") : t("Mes créations")}</h1>
              <button
                className="icon-button"
                aria-label={t("Fermer la liste")}
                onClick={close}
              >
                <X size={20} />
              </button>
            </header>
            <div className="sheet-scroll collection-grid">
              {visible.map((p, i) => card(p, filter === "top" ? i : undefined))}
              {!visible.length && (
                <div className="empty-state">
                  <span>
                    {loading ? t("Chargement...") : t("Aucune création")}
                  </span>
                  <button className="primary-button" onClick={add}>
                    <Plus size={19} />
                    {t("Construire")}
                  </button>
                </div>
              )}
            </div>
          </Sheet>
        )}
      </AnimatePresence>
      {notice && panel !== "proposal" && (
        <button className="ready-notice" onClick={() => open(notice)}>
          <img src={notice.image} alt="" />
          {t("Création prête")}
          <ArrowUpRight size={18} />
        </button>
      )}
      {error && !["studio", "proposal"].includes(panel) && (
        <div className="connection-error" role="alert">
          <span>{t(error)}</span>
          <button
            className="text-button"
            onClick={() => {
              setError("");
              void refresh();
            }}
          >
            {t("Réessayer")}
          </button>
          <button
            className="icon-button"
            aria-label={t("Fermer l'erreur")}
            onClick={() => setError("")}
          >
            <X size={18} />
          </button>
        </div>
      )}
      {menu && (
        <Modal
          title="Le Corbusier"
          onClose={() => setMenu(false)}
          className="app-menu"
        >
          <div
            className="language-switch"
            role="group"
            aria-label="Language / Langue"
          >
            <button
              aria-label="Français"
              aria-pressed={language === "fr"}
              onClick={() => setLanguage("fr")}
            >
              FR
            </button>
            <button
              aria-label="English"
              aria-pressed={language === "en"}
              onClick={() => setLanguage("en")}
            >
              EN
            </button>
          </div>
          <button
            className="menu-row"
            onClick={() => {
              setMenu(false);
              // Use the menu's history entry so Back returns to the previous view once.
              history.replaceState(
                {
                  lc: {
                    panel: "welcome",
                    selected: null,
                    filter: "all",
                    building: false,
                    depth: (history.state?.lc?.depth || 0) + 1,
                  },
                },
                "",
                BASE + "/",
              );
              setPanel("welcome");
              setSelected(null);
              setBuilding(false);
              setFilter("all");
              mapControl.current?.home();
            }}
          >
            <MapInfoIcon />
            <strong>{t("Comment jouer")}</strong>
            <ChevronRight size={18} />
          </button>
          {!installed && (
            <button className="menu-row" onClick={() => void installApp()}>
              <Smartphone size={22} />
              <strong>{t("Installer l'app")}</strong>
              <ChevronRight size={18} />
            </button>
          )}
          <button
            className="menu-row"
            onClick={() => {
              setMenu(false);
              void share();
            }}
          >
            <Share2 size={22} />
            <strong>{t("Partager l'app")}</strong>
            <ChevronRight size={18} />
          </button>
          <a
            className="menu-row"
            href="https://github.com/kennethassogba/lecorbusier"
            target="_blank"
            rel="noreferrer"
          >
            <span>{t("Code source")}</span>
            <ArrowUpRight size={18} />
          </a>
          <details className="app-credits">
            <summary>{t("Crédits")}</summary>
            {config.places.map((p) => (
              <div key={p.id}>
                <strong>{t(p.name)}</strong>
                <PhotoCredit place={p} />
              </div>
            ))}
          </details>
        </Modal>
      )}
      {installHelp && (
        <Modal
          title={t("Installer l'app")}
          onClose={() => setInstallHelp(false)}
          className="install-modal"
        >
          <img className="install-icon" src={BASE + "/icon-192.png"} alt="" />
          <ol className="install-steps">
            {/iPhone|iPad|iPod/.test(navigator.userAgent) ||
            (navigator.platform === "MacIntel" &&
              navigator.maxTouchPoints > 1) ? (
              <>
                <li>
                  <Share2 size={24} />
                  <span>{t("Partager")}</span>
                </li>
                <li>
                  <Plus size={24} />
                  <span>{t("Sur l'écran d'accueil")}</span>
                </li>
              </>
            ) : (
              <>
                <li>
                  <MoreHorizontal size={24} />
                  <span>{t("Menu du navigateur")}</span>
                </li>
                <li>
                  <Download size={24} />
                  <span>{t("Installer l'application")}</span>
                </li>
              </>
            )}
          </ol>
          <button
            className="primary-button"
            onClick={() => setInstallHelp(false)}
          >
            {t("Fermer")}
          </button>
        </Modal>
      )}
      {shareApp && <SharePanel onClose={() => setShareApp(false)} />}
      {previewPlace && (
        <Modal
          title={previewPlace.name}
          onClose={() => setPreviewPlace(null)}
          className="image-viewer"
        >
          <img src={previewPlace.image} alt={previewPlace.name} />
          <PhotoCredit place={previewPlace} />
        </Modal>
      )}
    </main>
  );
}
function RotateIcon() {
  return <span aria-label={t("Création à reprendre")}>!</span>;
}
