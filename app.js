(() => {
  "use strict";

  const STORAGE_KEYS = {
    participants: "groupTrip.participants.v1",
    rooms: "groupTrip.rooms.v1",
    admin: "groupTrip.admin.v1",
    session: "groupTrip.session.v1",
    resetRequests: "groupTrip.resetRequests.v1",
    itinerary: "groupTrip.itinerary.v1",
  };

  const SUPABASE_URL = "https://ykvhwhrgahczfmlasalg.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlreXdod3JnYWhjemZtbGFzYWxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0OTY0OTgsImV4cCI6MjA5OTA3MjQ5OH0.rqt74LCMHYrjhiOebEjFd_3ueydT0BKphY7aojD2K3I";
  const SUPABASE_RESERVATIONS_TABLE = "reservations";
  const SUPABASE_COLUMNS =
    "id, room_id, room_name, user_name, pin_code, created_at";
  const SUPABASE_IS_CONFIGURED =
    SUPABASE_URL !== "ここにProject URLを貼る" &&
    SUPABASE_ANON_KEY !== "ここにanon public keyを貼る";
  const supabaseClient =
    SUPABASE_IS_CONFIGURED && window.supabase
      ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
      : null;

  const MAX_PARTICIPANTS = 33;
  const INITIAL_ADMIN = {
    email: "admin@group-trip.jp",
    password: "Room33!",
    resetToken: null,
    resetRequestedAt: null,
  };

  const ROOM_IMAGE_SETS = {
    superior: [
      "./assets/rooms/superior-1.jpg",
      "./assets/rooms/superior-2.jpg",
    ],
    modern: [
      "./assets/rooms/modern-1.jpg",
      "./assets/rooms/modern-2.jpg",
    ],
    deluxe: [
      "./assets/rooms/deluxe-1.jpg",
      "./assets/rooms/deluxe-2.jpg",
    ],
    family: [
      "./assets/rooms/family-1.jpg",
      "./assets/rooms/family-2.jpg",
    ],
  };

  const INITIAL_ROOMS = [
    {
      id: "superior-a",
      name: "スーペリア A",
      capacity: 5,
      images: ROOM_IMAGE_SETS.superior,
      participantIds: [],
    },
    {
      id: "superior-b",
      name: "スーペリア B",
      capacity: 5,
      images: ROOM_IMAGE_SETS.superior,
      participantIds: [],
    },
    {
      id: "modern-a",
      name: "モダンルーム A",
      capacity: 5,
      images: ROOM_IMAGE_SETS.modern,
      participantIds: [],
    },
    {
      id: "modern-b",
      name: "モダンルーム B",
      capacity: 5,
      images: ROOM_IMAGE_SETS.modern,
      participantIds: [],
    },
    {
      id: "deluxe-a",
      name: "デラックス A",
      capacity: 6,
      images: ROOM_IMAGE_SETS.deluxe,
      participantIds: [],
    },
    {
      id: "family-a",
      name: "ファミリー A",
      capacity: 6,
      images: ROOM_IMAGE_SETS.family,
      participantIds: [],
    },
  ];

  const REMOVED_ROOM_TARGETS = new Map([
    ["deluxe-b", "deluxe-a"],
    ["family-b", "family-a"],
  ]);

  const LEGACY_ROOM_ORDER = [
    "room-4-1",
    "room-4-2",
    "room-4-3",
    "room-4-4",
    "room-4-5",
    "room-3-1",
    "room-3-2",
    "room-3-3",
    "room-3-4",
    "room-2-1",
  ];

  const LEGACY_ROOM_TARGETS = new Map(
    LEGACY_ROOM_ORDER.map((legacyId, index) => [
      legacyId,
      INITIAL_ROOMS[Math.min(index, INITIAL_ROOMS.length - 1)].id,
    ])
  );

  const BUS_SEAT_ROWS = [
    ...Array.from({ length: 10 }, (_, index) => {
      const row = index + 1;
      return [`${row}A`, `${row}B`, `${row}C`, `${row}D`];
    }),
    ["11A", "11B", "11C", "11D", "11E"],
  ];

  const BUS_SEAT_IDS = new Set(BUS_SEAT_ROWS.flat());

  const state = {
    participants: [],
    rooms: [],
    itinerary: [],
    admin: null,
    session: {
      participantId: null,
      adminAuthenticated: false,
    },
    pendingRoomId: null,
    editingItineraryId: null,
    legacyRoomReservations: [],
    legacyParticipantRoomIds: new Map(),
    supabaseReservationsLoaded: false,
    supabaseError: null,
    activeView: "booking",
    busSelections: {
      outbound: new Set(),
      return: new Set(),
    },
  };

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  const elements = {
    participantAccess: $(".participant-access"),
    participantAuth: $("#participant-auth"),
    participantLoginForm: $("#participant-login-form"),
    participantLoginName: $("#participant-login-name"),
    participantLoginPassword: $("#participant-login-password"),
    participantRegisterForm: $("#participant-register-form"),
    participantRegisterName: $("#participant-register-name"),
    participantRegisterPassword: $("#participant-register-password"),
    participantLoginPanel: $("#participant-login-panel"),
    participantRegisterPanel: $("#participant-register-panel"),
    participantSession: $("#participant-session"),
    participantLogout: $("#participant-logout"),
    sessionName: $("#session-name"),
    sessionBooking: $("#session-booking"),
    notice: $("#notice"),
    roomGrid: $("#room-grid"),
    bookingGuidance: $("#booking-guidance"),
    bookingSummary: $("#booking-summary"),
    statusOverview: $("#status-overview"),
    statusList: $("#status-list"),
    itineraryList: $("#itinerary-list"),
    adminLoginView: $("#admin-login-view"),
    adminLoginForm: $("#admin-login-form"),
    adminResetView: $("#admin-reset-view"),
    adminResetForm: $("#admin-reset-form"),
    adminResetComplete: $("#admin-reset-complete"),
    adminDashboard: $("#admin-dashboard"),
    adminStats: $("#admin-stats"),
    adminRoomList: $("#admin-room-list"),
    unbookedList: $("#unbooked-list"),
    unbookedCount: $("#unbooked-count"),
    adminParticipantAccountList: $("#admin-participant-account-list"),
    itineraryForm: $("#itinerary-form"),
    itineraryDate: $("#itinerary-date"),
    itineraryTime: $("#itinerary-time"),
    itineraryEntryTitle: $("#itinerary-entry-title"),
    itineraryLocation: $("#itinerary-location"),
    itineraryNote: $("#itinerary-note"),
    saveItinerary: $("#save-itinerary"),
    cancelItineraryEdit: $("#cancel-itinerary-edit"),
    adminItineraryList: $("#admin-itinerary-list"),
    busSeatMaps: $("#bus-seat-maps"),
    busLoginRequired: $("#bus-login-required"),
    busBookingContent: $("#bus-booking-content"),
    busLayout: $(".bus-layout"),
    busFormCard: $(".bus-form-card"),
    busDescription: $("#bus-description"),
    outboundSeatMap: $("#outbound-seat-map"),
    returnSeatMap: $("#return-seat-map"),
    outboundSeatCount: $("#outbound-seat-count"),
    returnSeatCount: $("#return-seat-count"),
    busAccountName: $("#bus-account-name"),
    busOutboundSummary: $("#bus-outbound-summary"),
    busReturnSummary: $("#bus-return-summary"),
    busFormErrors: $("#bus-form-errors"),
    confirmBusReservation: $("#confirm-bus-reservation"),
    busConfirmation: $("#bus-confirmation"),
    busConfirmationDetails: $("#bus-confirmation-details"),
    bookingDialog: $("#booking-dialog"),
    dialogTitle: $("#dialog-title"),
    dialogMessage: $("#dialog-message"),
    confirmBooking: $("#confirm-booking"),
    headerMenu: $("#header-menu"),
    headerMenuToggle: $("#header-menu-toggle"),
    headerMenuPanel: $("#header-menu-panel"),
    menuParticipantLogin: $("#menu-participant-login"),
    menuBooking: $("#menu-booking"),
    menuStatus: $("#menu-status"),
    menuItinerary: $("#menu-itinerary"),
    menuAdmin: $("#menu-admin"),
    menuLogout: $("#menu-logout"),
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function safeParse(value, fallback) {
    try {
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  }

  function getSupabaseSetupError() {
    if (!SUPABASE_IS_CONFIGURED) {
      return "Supabase接続情報を設定してください。app.js の SUPABASE_URL と SUPABASE_ANON_KEY を実際の値に置き換えると予約機能を使用できます。";
    }

    if (!window.supabase || !supabaseClient) {
      return "Supabase JavaScript Clientを読み込めませんでした。index.html のSupabase scriptタグを確認してください。";
    }

    return "";
  }

  function resolveCurrentRoomId(roomId) {
    if (!roomId) return null;
    const currentRoomIds = new Set(INITIAL_ROOMS.map((room) => room.id));
    if (currentRoomIds.has(roomId)) return roomId;
    return REMOVED_ROOM_TARGETS.get(roomId) || LEGACY_ROOM_TARGETS.get(roomId) || null;
  }

  function extractLegacyRoomReservations(participants) {
    const roomMap = new Map(INITIAL_ROOMS.map((room) => [room.id, room]));
    const seenNames = new Set();

    return participants
      .map((participant) => {
        const roomId = resolveCurrentRoomId(participant.roomId);
        const room = roomMap.get(roomId);
        const name = normalizeName(participant.name || "");
        if (!name || !room || seenNames.has(comparableName(name))) return null;
        seenNames.add(comparableName(name));
        return {
          room_id: room.id,
          room_name: room.name,
          user_name: name,
          pin_code:
            typeof participant.password === "string" &&
            /^[0-9]{4}$/.test(participant.password)
              ? participant.password
              : "",
        };
      })
      .filter(Boolean);
  }

  function resetRoomReservations() {
    state.rooms = clone(INITIAL_ROOMS);
    state.participants.forEach((participant) => {
      participant.roomId = null;
    });
  }

  function getLocalParticipantSnapshot() {
    return state.participants.map((participant) => ({
      ...participant,
      roomId: state.supabaseReservationsLoaded
        ? null
        : state.legacyParticipantRoomIds.get(participant.id) ||
          participant.roomId ||
          null,
      supabaseReservationId: undefined,
    }));
  }

  function findParticipantByName(name) {
    const targetName = comparableName(name);
    return (
      state.participants.find(
        (participant) => comparableName(participant.name) === targetName
      ) || null
    );
  }

  function loadState() {
    const storedParticipants = safeParse(
      localStorage.getItem(STORAGE_KEYS.participants),
      []
    );
    const storedAdmin = safeParse(localStorage.getItem(STORAGE_KEYS.admin), null);
    const storedSession = safeParse(localStorage.getItem(STORAGE_KEYS.session), null);
    const storedItinerary = safeParse(
      localStorage.getItem(STORAGE_KEYS.itinerary),
      []
    );

    state.participants = Array.isArray(storedParticipants)
      ? storedParticipants
          .filter(
            (participant) =>
              participant &&
              typeof participant.name === "string" &&
              normalizeName(participant.name)
          )
          .map((participant) => ({
            ...participant,
            id: participant.id || createId(),
            name: normalizeName(participant.name),
          }))
      : [];
    state.legacyRoomReservations = extractLegacyRoomReservations(
      state.participants
    );
    state.legacyParticipantRoomIds = new Map(
      state.participants.map((participant) => [
        participant.id,
        participant.roomId || null,
      ])
    );
    resetRoomReservations();
    state.itinerary = Array.isArray(storedItinerary)
      ? storedItinerary.filter(
          (entry) =>
            entry &&
            typeof entry.id === "string" &&
            typeof entry.date === "string" &&
            typeof entry.time === "string" &&
            typeof entry.title === "string"
        )
      : [];
    state.admin =
      storedAdmin && storedAdmin.email && storedAdmin.password
        ? storedAdmin
        : clone(INITIAL_ADMIN);
    state.session = {
      participantId: storedSession?.participantId || null,
      adminAuthenticated: Boolean(storedSession?.adminAuthenticated),
    };

    repairRelationships();
  }

  function mergeRoomDefinitions(storedRooms) {
    const currentRoomIds = new Set(INITIAL_ROOMS.map((room) => room.id));
    const hasCurrentRoomData = storedRooms.some((room) =>
      currentRoomIds.has(room.id)
    );

    if (!hasCurrentRoomData) {
      const migratedRooms = clone(INITIAL_ROOMS);
      const migratedRoomMap = new Map(
        migratedRooms.map((room) => [room.id, room])
      );

      state.participants.forEach((participant) => {
        if (!participant.roomId) return;

        const preferredRoomId = currentRoomIds.has(participant.roomId)
          ? participant.roomId
          : LEGACY_ROOM_TARGETS.get(participant.roomId);
        let targetRoom = migratedRoomMap.get(preferredRoomId);

        if (!targetRoom || targetRoom.participantIds.length >= targetRoom.capacity) {
          targetRoom = migratedRooms.find(
            (room) => room.participantIds.length < room.capacity
          );
        }

        if (!targetRoom) {
          participant.roomId = null;
          return;
        }

        participant.roomId = targetRoom.id;
        targetRoom.participantIds.push(participant.id);
      });

      return migratedRooms;
    }

    const mergedRooms = INITIAL_ROOMS.map((definition) => {
      const stored = storedRooms.find((room) => room.id === definition.id);
      return {
        ...definition,
        participantIds: Array.isArray(stored?.participantIds)
          ? stored.participantIds
          : [],
      };
    });
    const mergedRoomMap = new Map(
      mergedRooms.map((room) => [room.id, room])
    );

    state.participants.forEach((participant) => {
      if (!participant.roomId || currentRoomIds.has(participant.roomId)) return;

      const preferredRoomId =
        REMOVED_ROOM_TARGETS.get(participant.roomId) ||
        LEGACY_ROOM_TARGETS.get(participant.roomId);
      let targetRoom = mergedRoomMap.get(preferredRoomId);

      if (!targetRoom || targetRoom.participantIds.length >= targetRoom.capacity) {
        targetRoom = mergedRooms.find(
          (room) => room.participantIds.length < room.capacity
        );
      }

      if (!targetRoom) {
        participant.roomId = null;
        return;
      }

      participant.roomId = targetRoom.id;
      if (!targetRoom.participantIds.includes(participant.id)) {
        targetRoom.participantIds.push(participant.id);
      }
    });

    return mergedRooms;
  }

  function repairRelationships() {
    const validParticipantIds = new Set(
      state.participants.map((participant) => participant.id)
    );
    const validRoomIds = new Set(state.rooms.map((room) => room.id));

    state.participants.forEach((participant) => {
      if (participant.roomId && !validRoomIds.has(participant.roomId)) {
        participant.roomId = null;
      }
    });

    state.rooms.forEach((room) => {
      room.participantIds = [
        ...new Set(
          room.participantIds.filter((participantId) =>
            validParticipantIds.has(participantId)
          )
        ),
      ];
    });

    state.participants.forEach((participant) => {
      state.rooms.forEach((room) => {
        const shouldContain = participant.roomId === room.id;
        const contains = room.participantIds.includes(participant.id);
        if (shouldContain && !contains && room.participantIds.length < room.capacity) {
          room.participantIds.push(participant.id);
        }
        if (!shouldContain && contains) {
          room.participantIds = room.participantIds.filter(
            (participantId) => participantId !== participant.id
          );
        }
      });
    });

    if (
      state.session.participantId &&
      !validParticipantIds.has(state.session.participantId)
    ) {
      state.session.participantId = null;
    }
  }

  function saveAll() {
    localStorage.setItem(
      STORAGE_KEYS.participants,
      JSON.stringify(getLocalParticipantSnapshot())
    );
    if (state.supabaseReservationsLoaded) {
      localStorage.removeItem(STORAGE_KEYS.rooms);
    }
    localStorage.setItem(
      STORAGE_KEYS.itinerary,
      JSON.stringify(state.itinerary)
    );
    localStorage.setItem(STORAGE_KEYS.admin, JSON.stringify(state.admin));
    saveSession();
  }

  function saveSession() {
    localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(state.session));
  }

  function normalizeName(name) {
    return name.trim().replace(/\s+/g, " ");
  }

  function comparableName(name) {
    return normalizeName(name).toLocaleLowerCase("ja");
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getCurrentParticipant() {
    return (
      state.participants.find(
        (participant) => participant.id === state.session.participantId
      ) || null
    );
  }

  function getRoom(roomId) {
    return state.rooms.find((room) => room.id === roomId) || null;
  }

  function getRoomMembers(room) {
    return room.participantIds
      .map((participantId) =>
        state.participants.find(
          (participant) => participant.id === participantId
        )
      )
      .filter(Boolean);
  }

  function createId() {
    if (window.crypto?.randomUUID) {
      return window.crypto.randomUUID();
    }
    return `participant-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function normalizeSupabaseReservation(row) {
    if (!row || !row.user_name || !row.room_id) return null;

    const roomId = resolveCurrentRoomId(row.room_id);
    const room = getRoom(roomId) || INITIAL_ROOMS.find((item) => item.id === roomId);
    const userName = normalizeName(row.user_name);

    if (!room || !userName) return null;

    return {
      id: row.id,
      roomId: room.id,
      roomName: row.room_name || room.name,
      userName,
      pinCode: /^[0-9]{4}$/.test(String(row.pin_code || ""))
        ? String(row.pin_code)
        : "",
      createdAt: row.created_at || new Date().toISOString(),
    };
  }

  function assignParticipantToRoom(participant, roomId) {
    state.rooms.forEach((room) => {
      room.participantIds = room.participantIds.filter(
        (participantId) => participantId !== participant.id
      );
    });

    const room = getRoom(roomId);
    if (!room) {
      participant.roomId = null;
      participant.supabaseReservationId = null;
      return;
    }

    participant.roomId = room.id;
    if (!room.participantIds.includes(participant.id)) {
      room.participantIds.push(participant.id);
    }
  }

  function applySupabaseReservations(rows) {
    resetRoomReservations();

    const reservations = rows
      .map(normalizeSupabaseReservation)
      .filter(Boolean)
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));

    reservations.forEach((reservation) => {
      let participant = findParticipantByName(reservation.userName);

      if (!participant) {
        participant = {
          id: `supabase-${reservation.id || createId()}`,
          name: reservation.userName,
          password: reservation.pinCode,
          roomId: null,
          createdAt: reservation.createdAt,
          updatedAt: reservation.createdAt,
        };
        state.participants.push(participant);
      }

      participant.name = reservation.userName;
      if (reservation.pinCode) {
        participant.password = reservation.pinCode;
      }
      participant.supabaseReservationId = reservation.id;
      participant.updatedAt = reservation.createdAt;
      assignParticipantToRoom(participant, reservation.roomId);
    });

    repairRelationships();
  }

  async function migrateLegacyReservationsIfNeeded(rows) {
    if (
      rows.length ||
      !state.legacyRoomReservations.length ||
      !supabaseClient
    ) {
      return rows;
    }

    const legacyReservations = state.legacyRoomReservations.filter(
      (reservation) =>
        reservation.room_id &&
        reservation.room_name &&
        reservation.user_name &&
        /^[0-9]{4}$/.test(reservation.pin_code)
    );

    if (!legacyReservations.length) return rows;

    const { error } = await supabaseClient
      .from(SUPABASE_RESERVATIONS_TABLE)
      .insert(legacyReservations);

    if (error) {
      console.error("Supabase legacy migration failed:", error);
      return rows;
    }

    const { data, error: reloadError } = await supabaseClient
      .from(SUPABASE_RESERVATIONS_TABLE)
      .select(SUPABASE_COLUMNS)
      .order("created_at", { ascending: true });

    if (reloadError) {
      console.error("Supabase reload after migration failed:", reloadError);
      return rows;
    }

    return Array.isArray(data) ? data : [];
  }

  async function loadSupabaseReservations({ showErrors = false } = {}) {
    const setupError = getSupabaseSetupError();
    if (setupError) {
      state.supabaseError = setupError;
      state.supabaseReservationsLoaded = false;
      resetRoomReservations();
      repairRelationships();
      if (showErrors) showNotice(setupError, "error");
      return false;
    }

    const { data, error } = await supabaseClient
      .from(SUPABASE_RESERVATIONS_TABLE)
      .select(SUPABASE_COLUMNS)
      .order("created_at", { ascending: true });

    if (error) {
      state.supabaseError = error.message;
      state.supabaseReservationsLoaded = false;
      resetRoomReservations();
      repairRelationships();
      console.error("Supabase reservation select failed:", error);
      if (showErrors) {
        showNotice(
          `Supabaseから予約データを取得できませんでした：${error.message}`,
          "error"
        );
      }
      return false;
    }

    const rows = await migrateLegacyReservationsIfNeeded(
      Array.isArray(data) ? data : []
    );
    applySupabaseReservations(rows);
    state.supabaseError = null;
    state.supabaseReservationsLoaded = true;
    saveAll();
    return true;
  }

  async function refreshSupabaseReservations({ showErrors = true } = {}) {
    const loaded = await loadSupabaseReservations({ showErrors });
    syncBusSelectionsWithCurrentParticipant();
    renderAll();
    return loaded;
  }

  async function deleteSupabaseReservationsForParticipant(participant) {
    const setupError = getSupabaseSetupError();
    if (setupError) throw new Error(setupError);

    const { error } = await supabaseClient
      .from(SUPABASE_RESERVATIONS_TABLE)
      .delete()
      .eq("user_name", participant.name);

    if (error) throw error;
  }

  async function insertSupabaseReservation(participant, room) {
    const setupError = getSupabaseSetupError();
    if (setupError) throw new Error(setupError);

    const { error } = await supabaseClient
      .from(SUPABASE_RESERVATIONS_TABLE)
      .insert({
        room_id: room.id,
        room_name: room.name,
        user_name: participant.name,
        pin_code: participant.password,
      });

    if (error) throw error;
  }

  async function updateSupabasePinCode(participant) {
    if (!participant.roomId || getSupabaseSetupError()) return;

    const { error } = await supabaseClient
      .from(SUPABASE_RESERVATIONS_TABLE)
      .update({ pin_code: participant.password })
      .eq("user_name", participant.name);

    if (error) throw error;
  }

  function showNotice(message, type = "success") {
    elements.notice.textContent = message;
    elements.notice.classList.toggle("is-error", type === "error");
    elements.notice.hidden = false;
    window.clearTimeout(showNotice.timeout);
    showNotice.timeout = window.setTimeout(() => {
      elements.notice.hidden = true;
    }, 5000);
  }

  function setHeaderMenuOpen(open, restoreFocus = false) {
    elements.headerMenuPanel.hidden = !open;
    elements.headerMenuToggle.setAttribute("aria-expanded", String(open));
    elements.headerMenuToggle.setAttribute(
      "aria-label",
      open ? "メニューを閉じる" : "メニューを開く"
    );

    if (open) {
      const firstVisibleItem = [
        elements.menuParticipantLogin,
        elements.menuBooking,
        elements.menuStatus,
        elements.menuItinerary,
        elements.menuAdmin,
        elements.menuLogout,
      ].find((item) => !item.hidden);
      firstVisibleItem?.focus();
    } else if (restoreFocus) {
      elements.headerMenuToggle.focus();
    }
  }

  function renderHeaderMenu() {
    const participant = getCurrentParticipant();
    const adminAuthenticated = state.session.adminAuthenticated;
    const isAdminState = adminAuthenticated;
    const isParticipantState = Boolean(participant) && !isAdminState;
    const isLoggedIn = isAdminState || isParticipantState;

    elements.menuParticipantLogin.hidden = isLoggedIn;
    elements.menuAdmin.hidden = isParticipantState;
    elements.menuAdmin.textContent = isAdminState
      ? "管理者ページ"
      : "管理者ログイン";
    elements.menuLogout.hidden = !isLoggedIn;

    [
      [elements.menuBooking, "booking"],
      [elements.menuStatus, "status"],
      [elements.menuItinerary, "itinerary"],
      [elements.menuAdmin, "admin"],
    ].forEach(([item, viewName]) => {
      item.setAttribute(
        "aria-current",
        state.activeView === viewName ? "page" : "false"
      );
    });
  }

  function scrollToActiveView() {
    const activeView = $(`#view-${state.activeView}`);
    activeView?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function logoutFromHeaderMenu() {
    const hadParticipantSession = Boolean(getCurrentParticipant());
    const hadAdminSession = state.session.adminAuthenticated;
    if (!hadParticipantSession && !hadAdminSession) return;

    state.session.participantId = null;
    state.session.adminAuthenticated = false;
    syncBusSelectionsWithCurrentParticipant();
    saveSession();
    resetItineraryEditor();
    elements.adminParticipantAccountList.innerHTML = "";
    showAdminLogin();
    renderAll();

    const accountLabel =
      hadParticipantSession && hadAdminSession
        ? "参加者・管理者"
        : hadAdminSession
          ? "管理者"
          : "参加者";
    showNotice(`${accountLabel}ログアウトしました。`);
  }

  function switchView(viewName) {
    state.activeView = viewName;
    $$(".tab-button").forEach((button) => {
      const active = button.dataset.view === viewName;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-current", active ? "page" : "false");
    });

    $$(".view").forEach((view) => {
      const active = view.id === `view-${viewName}`;
      view.hidden = !active;
      view.classList.toggle("is-active", active);
    });

    if (viewName === "status") renderStatus();
    if (viewName === "itinerary") renderItinerary();
    if (viewName === "bus") {
      syncBusSelectionsWithCurrentParticipant();
      renderBusView();
    }
    if (viewName === "admin") renderAdmin();
    renderHeaderMenu();
  }

  function switchParticipantAuth(mode) {
    const isLogin = mode === "login";
    elements.participantLoginPanel.hidden = !isLogin;
    elements.participantRegisterPanel.hidden = isLogin;

    $$("[data-participant-auth]").forEach((button) => {
      if (button.getAttribute("role") !== "tab") return;
      const active = button.dataset.participantAuth === mode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    });
  }

  function renderParticipantSession() {
    const participant = getCurrentParticipant();
    elements.participantAuth.hidden = Boolean(participant);
    elements.participantSession.hidden = !participant;

    if (!participant) {
      elements.participantLoginForm.reset();
      elements.participantRegisterForm.reset();
      switchParticipantAuth("login");
      elements.bookingGuidance.textContent =
        "ログイン後、ご希望の部屋を1つお選びいただけます。";
      elements.bookingSummary.hidden = true;
      return;
    }

    const room = getRoom(participant.roomId);
    elements.sessionName.textContent = participant.name;
    elements.sessionBooking.textContent = room
      ? `予約中：${room.name}`
      : "まだ部屋を予約していません";
    elements.bookingGuidance.textContent = room
      ? "別の部屋を選ぶと、現在の予約から移動します。"
      : "ご希望の部屋を1つお選びください。";

    if (room) {
      elements.bookingSummary.innerHTML = `<strong>現在の予約</strong>${escapeHtml(
        room.name
      )}`;
      elements.bookingSummary.hidden = false;
    } else {
      elements.bookingSummary.hidden = true;
    }
  }

  function renderRooms() {
    const participant = getCurrentParticipant();
    elements.roomGrid.innerHTML = state.rooms
      .map((room) => {
        const members = getRoomMembers(room);
        const isMine = participant?.roomId === room.id;
        const isFull = members.length >= room.capacity;
        const remaining = Math.max(room.capacity - members.length, 0);
        const occupancy = Math.min(
          Math.round((members.length / room.capacity) * 100),
          100
        );

        let buttonLabel = "予約する";
        let disabled = false;
        if (!participant) {
          buttonLabel = "ログインして予約";
          disabled = true;
        } else if (isMine) {
          buttonLabel = "予約中";
          disabled = true;
        } else if (isFull) {
          buttonLabel = "満室";
          disabled = true;
        } else if (participant.roomId) {
          buttonLabel = "この部屋へ移動";
        }

        const memberMarkup = members.length
          ? `<ul class="member-list">${members
              .map(
                (member) =>
                  `<li class="member-chip ${
                    member.id === participant?.id ? "is-me" : ""
                  }">${escapeHtml(member.name)}${
                    member.id === participant?.id ? "（自分）" : ""
                  }</li>`
              )
              .join("")}</ul>`
          : `<span class="empty-members">まだ予約者はいません</span>`;
        const roomImages = Array.isArray(room.images) ? room.images : [];
        const galleryMarkup = roomImages.length
          ? `
            <div
              class="room-gallery"
              data-room-gallery
              data-active-index="0"
              aria-label="${escapeHtml(room.name)}の写真"
            >
              <div class="room-gallery-viewport">
                <div class="room-gallery-track">
                  ${roomImages
                    .map(
                      (image, index) => `
                        <div
                          class="room-gallery-slide"
                          aria-hidden="${index === 0 ? "false" : "true"}"
                        >
                          <img
                            src="${escapeHtml(image)}"
                            alt="${escapeHtml(room.name)}の室内写真 ${index + 1}"
                            loading="lazy"
                          />
                        </div>
                      `
                    )
                    .join("")}
                </div>
              </div>
              ${
                roomImages.length > 1
                  ? `
                    <button
                      class="room-gallery-arrow is-previous"
                      type="button"
                      data-gallery-direction="-1"
                      aria-label="${escapeHtml(room.name)}の前の写真"
                    >
                      ‹
                    </button>
                    <button
                      class="room-gallery-arrow is-next"
                      type="button"
                      data-gallery-direction="1"
                      aria-label="${escapeHtml(room.name)}の次の写真"
                    >
                      ›
                    </button>
                    <div class="room-gallery-dots" aria-hidden="true">
                      ${roomImages
                        .map(
                          (_, index) =>
                            `<span class="${index === 0 ? "is-active" : ""}"></span>`
                        )
                        .join("")}
                    </div>
                  `
                  : ""
              }
            </div>
          `
          : "";

        return `
          <article class="room-card ${isMine ? "is-mine" : ""} ${
            isFull ? "is-full" : ""
          }">
            ${isMine ? '<span class="mine-ribbon">あなたの予約</span>' : ""}
            ${galleryMarkup}
            <div class="room-card-header">
              <h3>${escapeHtml(room.name)}</h3>
              <span class="capacity-label">定員 ${room.capacity}名</span>
            </div>
            <div class="occupancy-row">
              <span class="occupancy-label">予約状況</span>
              <span class="occupancy-number">${members.length}<small> / ${
          room.capacity
        }名</small></span>
            </div>
            <div class="occupancy-track" aria-label="予約率 ${occupancy}%">
              <div class="occupancy-fill" style="width: ${occupancy}%"></div>
            </div>
            <div class="member-section">
              <p class="member-label">予約済みメンバー</p>
              ${memberMarkup}
            </div>
            <button
              class="button ${isMine ? "button-secondary" : "button-primary"}"
              type="button"
              data-book-room="${room.id}"
              ${disabled ? "disabled" : ""}
            >
              ${buttonLabel}${!isFull && !isMine ? `（残り${remaining}名）` : ""}
            </button>
          </article>
        `;
      })
      .join("");
  }

  function moveRoomGallery(gallery, direction) {
    const slides = [...gallery.querySelectorAll(".room-gallery-slide")];
    if (slides.length < 2) return;

    const currentIndex = Number(gallery.dataset.activeIndex || 0);
    const nextIndex =
      (currentIndex + direction + slides.length) % slides.length;
    gallery.dataset.activeIndex = String(nextIndex);

    const track = gallery.querySelector(".room-gallery-track");
    track.style.transform = `translateX(-${nextIndex * 100}%)`;
    slides.forEach((slide, index) => {
      slide.setAttribute("aria-hidden", String(index !== nextIndex));
    });
    gallery.querySelectorAll(".room-gallery-dots span").forEach((dot, index) => {
      dot.classList.toggle("is-active", index === nextIndex);
    });
  }

  function renderStatus() {
    const bookedCount = state.participants.filter(
      (participant) => participant.roomId
    ).length;
    const remainingCapacity = state.rooms.reduce(
      (total, room) => total + (room.capacity - getRoomMembers(room).length),
      0
    );
    const fullRooms = state.rooms.filter(
      (room) => getRoomMembers(room).length >= room.capacity
    ).length;

    elements.statusOverview.innerHTML = `
      <div class="overview-item">
        <span class="overview-label">予約済み</span>
        <span class="overview-value">${bookedCount}<small>名</small></span>
      </div>
      <div class="overview-item">
        <span class="overview-label">全体の空き</span>
        <span class="overview-value">${remainingCapacity}<small>名</small></span>
      </div>
      <div class="overview-item">
        <span class="overview-label">満室</span>
        <span class="overview-value">${fullRooms}<small>室</small></span>
      </div>
    `;

    elements.statusList.innerHTML = state.rooms
      .map((room) => {
        const members = getRoomMembers(room);
        const remaining = room.capacity - members.length;
        return `
          <article class="status-row">
            <h3 class="status-room-name">${escapeHtml(room.name)}</h3>
            <div class="status-metric">
              <strong>${members.length}</strong> / ${room.capacity}名
              ・ 残り${remaining}名
            </div>
            <div>
              ${
                members.length
                  ? `<ul class="member-list">${members
                      .map(
                        (member) =>
                          `<li class="member-chip">${escapeHtml(
                            member.name
                          )}</li>`
                      )
                      .join("")}</ul>`
                  : '<span class="empty-members">予約者なし</span>'
              }
            </div>
          </article>
        `;
      })
      .join("");
  }

  function getSortedItinerary() {
    return [...state.itinerary].sort((a, b) =>
      `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`, "ja")
    );
  }

  function formatItineraryDate(dateValue) {
    const [year, month, day] = dateValue.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    if (Number.isNaN(date.getTime())) return dateValue;
    return new Intl.DateTimeFormat("ja-JP", {
      month: "long",
      day: "numeric",
      weekday: "short",
    }).format(date);
  }

  function renderItinerary() {
    const entries = getSortedItinerary();
    if (!entries.length) {
      elements.itineraryList.innerHTML = `
        <div class="itinerary-empty card">
          <p class="section-kicker">COMING SOON</p>
          <h3>工程表はまだ設定されていません</h3>
          <p>管理者が予定を登録すると、こちらに旅行のしおりが表示されます。</p>
        </div>
      `;
      return;
    }

    const groupedEntries = entries.reduce((groups, entry) => {
      if (!groups.has(entry.date)) groups.set(entry.date, []);
      groups.get(entry.date).push(entry);
      return groups;
    }, new Map());

    elements.itineraryList.innerHTML = [...groupedEntries]
      .map(
        ([date, dayEntries], dayIndex) => `
          <article class="itinerary-day card">
            <header class="itinerary-day-heading">
              <span class="itinerary-day-number">DAY ${dayIndex + 1}</span>
              <h3>${escapeHtml(formatItineraryDate(date))}</h3>
            </header>
            <ol class="itinerary-timeline">
              ${dayEntries
                .map(
                  (entry) => `
                    <li class="itinerary-entry">
                      <time datetime="${escapeHtml(
                        `${entry.date}T${entry.time}`
                      )}">${escapeHtml(entry.time)}</time>
                      <div class="itinerary-entry-marker" aria-hidden="true"></div>
                      <div class="itinerary-entry-content">
                        <h4>${escapeHtml(entry.title)}</h4>
                        ${
                          entry.location
                            ? `<p class="itinerary-location">場所：${escapeHtml(
                                entry.location
                              )}</p>`
                            : ""
                        }
                        ${
                          entry.note
                            ? `<p class="itinerary-note">${escapeHtml(
                                entry.note
                              ).replaceAll("\n", "<br>")}</p>`
                            : ""
                        }
                      </div>
                    </li>
                  `
                )
                .join("")}
            </ol>
          </article>
        `
      )
      .join("");
  }

  function renderAdminItinerary() {
    const entries = getSortedItinerary();
    elements.adminItineraryList.innerHTML = entries.length
      ? entries
          .map(
            (entry) => `
              <div class="admin-itinerary-row">
                <div class="admin-itinerary-datetime">
                  <strong>${escapeHtml(formatItineraryDate(entry.date))}</strong>
                  <span>${escapeHtml(entry.time)}</span>
                </div>
                <div class="admin-itinerary-content">
                  <strong>${escapeHtml(entry.title)}</strong>
                  ${
                    entry.location
                      ? `<span>${escapeHtml(entry.location)}</span>`
                      : ""
                  }
                </div>
                <div class="admin-itinerary-actions">
                  <button
                    class="button button-secondary"
                    type="button"
                    data-itinerary-edit="${escapeHtml(entry.id)}"
                  >
                    編集
                  </button>
                  <button
                    class="text-button itinerary-delete"
                    type="button"
                    data-itinerary-delete="${escapeHtml(entry.id)}"
                  >
                    削除
                  </button>
                </div>
              </div>
            `
          )
          .join("")
      : '<div class="empty-state">登録済みの工程はありません</div>';
  }

  function resetItineraryEditor() {
    state.editingItineraryId = null;
    elements.itineraryForm.reset();
    elements.saveItinerary.textContent = "工程を追加";
    elements.cancelItineraryEdit.hidden = true;
  }

  function renderAdmin() {
    elements.adminDashboard.hidden = !state.session.adminAuthenticated;
    elements.adminLoginView.hidden = state.session.adminAuthenticated;
    if (!state.session.adminAuthenticated) {
      elements.adminParticipantAccountList.innerHTML = "";
      return;
    }

    elements.adminResetView.hidden = true;
    elements.adminResetComplete.hidden = true;
    renderAdminItinerary();

    const booked = state.participants.filter(
      (participant) => participant.roomId
    );
    const unbooked = state.participants.filter(
      (participant) => !participant.roomId
    );
    const remaining = state.rooms.reduce(
      (total, room) => total + room.capacity - getRoomMembers(room).length,
      0
    );

    elements.adminStats.innerHTML = [
      ["登録参加者", state.participants.length, "名"],
      ["予約済み", booked.length, "名"],
      ["未予約", unbooked.length, "名"],
      ["残り定員", remaining, "名"],
    ]
      .map(
        ([label, value, unit]) => `
          <div class="stat-card">
            <span class="stat-label">${label}</span>
            <span class="stat-value">${value}<small>${unit}</small></span>
          </div>
        `
      )
      .join("");

    elements.adminRoomList.innerHTML = state.rooms
      .map((room) => {
        const members = getRoomMembers(room);
        const remainingCount = room.capacity - members.length;
        return `
          <div class="admin-room-row">
            <div>
              <strong>${escapeHtml(room.name)}</strong>
              <div class="admin-room-meta">定員 ${room.capacity}名</div>
            </div>
            <div class="admin-room-meta">
              <strong>${members.length}名予約</strong>
              残り ${remainingCount}名
            </div>
            <ul class="admin-members">
              ${
                members.length
                  ? members
                      .map(
                        (member) => `<li>${escapeHtml(member.name)}</li>`
                      )
                      .join("")
                  : "<li class='empty-members'>予約者なし</li>"
              }
            </ul>
          </div>
        `;
      })
      .join("");

    elements.unbookedCount.textContent = String(unbooked.length);
    elements.unbookedList.innerHTML = unbooked.length
      ? `<ul class="unbooked-list">${unbooked
          .map((participant) => `<li>${escapeHtml(participant.name)}</li>`)
          .join("")}</ul>`
      : '<div class="empty-state">未予約の参加者はいません</div>';

    elements.adminParticipantAccountList.innerHTML = state.participants.length
      ? state.participants
          .map((participant) => {
            const password =
              typeof participant.password === "string" &&
              /^[0-9]{4}$/.test(participant.password)
                ? participant.password
                : "";
            const room = getRoom(participant.roomId);
            return `
              <form
                class="participant-password-row"
                data-participant-password-form
                data-participant-id="${participant.id}"
                novalidate
              >
                <div class="participant-account-name">
                  <strong>${escapeHtml(participant.name)}</strong>
                  <span>${room ? escapeHtml(room.name) : "部屋未予約"}</span>
                </div>
                <span class="password-status ${
                  password ? "is-set" : "is-unset"
                }">${password ? "設定済み" : "未設定"}</span>
                <div class="password-edit-controls">
                  <input
                    type="text"
                    inputmode="numeric"
                    maxlength="4"
                    pattern="[0-9]{4}"
                    value="${password}"
                    placeholder="数字4桁"
                    aria-label="${escapeHtml(participant.name)}の4桁パスワード"
                    data-participant-password-input
                  />
                  <button class="button button-secondary" type="submit">
                    変更を保存
                  </button>
                </div>
                <button
                  class="participant-delete-button"
                  type="button"
                  data-delete-participant="${participant.id}"
                  aria-label="${escapeHtml(participant.name)}のアカウントを削除"
                >
                  アカウント削除
                </button>
              </form>
            `;
          })
          .join("")
      : '<div class="empty-state">登録済みの参加者はいません</div>';
  }

  function getBusReservationSeat(participant, trip) {
    const key = trip === "outbound" ? "outboundSeat" : "returnSeat";
    const seatId = participant?.busReservation?.[key];
    return BUS_SEAT_IDS.has(seatId) ? seatId : null;
  }

  function getReservedBusSeats(trip) {
    const currentParticipant = getCurrentParticipant();
    return new Set(
      state.participants
        .filter((participant) => participant.id !== currentParticipant?.id)
        .map((participant) => getBusReservationSeat(participant, trip))
        .filter(Boolean)
    );
  }

  function getBusSeatOwner(trip, seatId) {
    const currentParticipant = getCurrentParticipant();
    const otherParticipant = state.participants.find(
      (participant) =>
        participant.id !== currentParticipant?.id &&
        getBusReservationSeat(participant, trip) === seatId
    );

    if (otherParticipant) return otherParticipant;

    return (
      state.participants.find(
        (participant) => getBusReservationSeat(participant, trip) === seatId
      ) || null
    );
  }

  function syncBusSelectionsWithCurrentParticipant() {
    const participant = getCurrentParticipant();
    state.busSelections.outbound.clear();
    state.busSelections.return.clear();
    showBusFormErrors([]);
    invalidateBusConfirmation();

    if (!participant) return;

    const outboundSeat = getBusReservationSeat(participant, "outbound");
    const returnSeat = getBusReservationSeat(participant, "return");
    if (outboundSeat) state.busSelections.outbound.add(outboundSeat);
    if (returnSeat) state.busSelections.return.add(returnSeat);
  }

  function renderBusSeatMap(trip) {
    const isOutbound = trip === "outbound";
    const currentParticipant = getCurrentParticipant();
    const container = isOutbound
      ? elements.outboundSeatMap
      : elements.returnSeatMap;
    const countElement = isOutbound
      ? elements.outboundSeatCount
      : elements.returnSeatCount;
    const tripLabel = isOutbound ? "行き" : "帰り";
    const selectedSeats = state.busSelections[trip];
    const reservedSeats = getReservedBusSeats(trip);

    container.innerHTML = BUS_SEAT_ROWS.map((rowSeats, index) => {
      const isLastRow = rowSeats.length === 5;
      const seatButtons = rowSeats.map((seatId) => {
        const owner = getBusSeatOwner(trip, seatId);
        const isReserved = reservedSeats.has(seatId);
        const isOwnReservation = Boolean(
          currentParticipant && owner?.id === currentParticipant.id
        );
        const isSelected = selectedSeats.has(seatId);
        const isViewOnly = !currentParticipant;
        const status = isReserved ? "予約済み" : isSelected ? "選択中" : "空席";
        const ownerLabel = owner
          ? `
              <span class="bus-seat-number">${escapeHtml(seatId)}</span>
              <span class="bus-seat-owner">${escapeHtml(owner.name)}</span>
            `
          : `<span class="bus-seat-number">${escapeHtml(seatId)}</span>`;
        return `
          <button
            class="bus-seat ${isReserved ? "is-reserved" : ""} ${
              isSelected ? "is-selected" : ""
            } ${isOwnReservation ? "is-own-reservation" : ""} ${
              isViewOnly ? "is-view-only" : ""
            }"
            type="button"
            data-bus-trip="${trip}"
            data-bus-seat="${seatId}"
            aria-label="${tripLabel} ${seatId} ${status}${
              owner ? ` ${escapeHtml(owner.name)}` : ""
            }"
            ${owner ? `title="${escapeHtml(`${seatId}：${owner.name}`)}"` : ""}
            aria-pressed="${isSelected}"
            ${isViewOnly && !isReserved ? 'aria-disabled="true" tabindex="-1"' : ""}
            ${isReserved ? "disabled" : ""}
          >${ownerLabel}</button>
        `;
      });

      if (!isLastRow) {
        seatButtons.splice(2, 0, '<span class="bus-aisle" aria-hidden="true"></span>');
      }

      return `
        <div class="bus-seat-row ${isLastRow ? "is-last" : ""}" aria-label="${
          index + 1
        }列目">
          ${seatButtons.join("")}
        </div>
      `;
    }).join("");

    const count = selectedSeats.size;
    countElement.textContent = currentParticipant
      ? count
        ? `${count}席選択中`
        : "未選択"
      : "閲覧のみ";
    countElement.classList.toggle("has-selection", count > 0);
  }

  function renderBusSeatMaps() {
    renderBusSeatMap("outbound");
    renderBusSeatMap("return");
  }

  function renderBusSelectionSummary() {
    const outboundSeat = [...state.busSelections.outbound][0] || "未選択";
    const returnSeat = [...state.busSelections.return][0] || "未選択";
    elements.busOutboundSummary.textContent = outboundSeat;
    elements.busReturnSummary.textContent = returnSeat;
  }

  function renderBusView() {
    const participant = getCurrentParticipant();
    elements.busLoginRequired.hidden = Boolean(participant);
    elements.busBookingContent.hidden = false;
    elements.busFormCard.hidden = !participant;
    elements.busLayout.classList.toggle("is-view-only", !participant);
    elements.busDescription.textContent = participant
      ? "行き・帰り、それぞれの座席表からご希望の席をお選びください。"
      : "ログインしなくても、行き・帰りの予約済み座席と参加者名を確認できます。";
    renderBusSeatMaps();

    if (!participant) {
      invalidateBusConfirmation();
      return;
    }

    elements.busAccountName.textContent = participant.name;
    const hasReservation =
      getBusReservationSeat(participant, "outbound") &&
      getBusReservationSeat(participant, "return");
    elements.confirmBusReservation.textContent = hasReservation
      ? "予約する座席を変更する"
      : "この内容で予約する";
    renderBusSelectionSummary();
  }

  function invalidateBusConfirmation() {
    elements.busConfirmation.hidden = true;
  }

  function showBusFormErrors(messages) {
    if (!messages.length) {
      elements.busFormErrors.hidden = true;
      elements.busFormErrors.innerHTML = "";
      return;
    }

    elements.busFormErrors.innerHTML = `
      <p>入力内容をご確認ください</p>
      <ul>${messages.map((message) => `<li>${escapeHtml(message)}</li>`).join("")}</ul>
    `;
    elements.busFormErrors.hidden = false;
  }

  function confirmBusReservation() {
    const participant = getCurrentParticipant();
    const outboundSeat = [...state.busSelections.outbound][0] || null;
    const returnSeat = [...state.busSelections.return][0] || null;
    const errors = [];

    if (!participant) {
      errors.push("参加者アカウントでログインしてください");
    }
    if (!outboundSeat || !returnSeat) {
      errors.push("行きと帰りの座席を1席ずつ選択してください");
    }
    if (outboundSeat && getReservedBusSeats("outbound").has(outboundSeat)) {
      errors.push(`行きの${outboundSeat}はすでに予約されています`);
    }
    if (returnSeat && getReservedBusSeats("return").has(returnSeat)) {
      errors.push(`帰りの${returnSeat}はすでに予約されています`);
    }

    showBusFormErrors(errors);
    if (errors.length) {
      invalidateBusConfirmation();
      return;
    }

    participant.busReservation = {
      outboundSeat,
      returnSeat,
      updatedAt: new Date().toISOString(),
    };
    saveAll();

    const confirmationItems = [
      ["参加者", participant.name, ""],
      ["行きのバス", outboundSeat, ""],
      ["帰りのバス", returnSeat, ""],
    ];

    elements.busConfirmationDetails.innerHTML = confirmationItems
      .map(
        ([label, value, className]) => `
          <div class="confirmation-item ${className}">
            <dt>${escapeHtml(label)}</dt>
            <dd>${escapeHtml(value).replaceAll("\n", "<br>")}</dd>
          </div>
        `
      )
      .join("");
    renderBusView();
    elements.busConfirmation.hidden = false;
    showNotice(
      `${participant.name}さんのバス座席（行き ${outboundSeat}・帰り ${returnSeat}）を予約しました。`
    );
    elements.busConfirmation.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function renderAll() {
    renderParticipantSession();
    renderRooms();
    renderStatus();
    renderItinerary();
    renderBusView();
    if (state.activeView === "admin") renderAdmin();
    renderHeaderMenu();
  }

  function getParticipantCredentials(rawName, rawPassword, passwordInput) {
    const name = normalizeName(rawName);
    const password = String(rawPassword || "");
    if (!name) {
      showNotice("お名前を入力してください。", "error");
      return null;
    }

    if (!/^[0-9]{4}$/.test(password)) {
      showNotice("パスワードは数字4桁で入力してください。", "error");
      passwordInput.value = "";
      return null;
    }

    return { name, password };
  }

  function completeParticipantLogin(participant, message) {
    state.session.participantId = participant.id;
    syncBusSelectionsWithCurrentParticipant();
    elements.participantLoginForm.reset();
    elements.participantRegisterForm.reset();
    saveAll();
    renderAll();
    switchView("booking");
    showNotice(message);
  }

  async function loginParticipant(rawName, rawPassword) {
    const credentials = getParticipantCredentials(
      rawName,
      rawPassword,
      elements.participantLoginPassword
    );
    if (!credentials) return;

    const { name, password } = credentials;
    const participant = state.participants.find(
      (item) => comparableName(item.name) === comparableName(name)
    );

    if (!participant) {
      showNotice(
        "登録が見つかりません。初めての方は「新規登録」から登録してください。",
        "error"
      );
      elements.participantLoginPassword.value = "";
      return;
    }

    if (
      typeof participant.password !== "string" ||
      !/^[0-9]{4}$/.test(participant.password)
    ) {
      participant.password = password;
      participant.updatedAt = new Date().toISOString();
      try {
        await updateSupabasePinCode(participant);
      } catch (error) {
        showNotice(
          `パスワードの保存に失敗しました：${error.message}`,
          "error"
        );
        return;
      }
      completeParticipantLogin(
        participant,
        `${participant.name}さんの4桁パスワードを設定してログインしました。`
      );
      return;
    }

    if (participant.password !== password) {
      showNotice(
        "パスワードが違います。登録時の数字4桁を確認してください。",
        "error"
      );
      elements.participantLoginPassword.value = "";
      return;
    }

    completeParticipantLogin(
      participant,
      `${participant.name}さんでログインしました。`
    );
  }

  function registerParticipant(rawName, rawPassword) {
    const credentials = getParticipantCredentials(
      rawName,
      rawPassword,
      elements.participantRegisterPassword
    );
    if (!credentials) return;

    const { name, password } = credentials;
    const existingParticipant = state.participants.find(
      (item) => comparableName(item.name) === comparableName(name)
    );

    if (existingParticipant) {
      showNotice(
        "このお名前は登録済みです。「ログイン」からお進みください。",
        "error"
      );
      elements.participantRegisterPassword.value = "";
      return;
    }

    if (state.participants.length >= MAX_PARTICIPANTS) {
      showNotice(
        `参加者の登録上限（${MAX_PARTICIPANTS}名）に達しています。`,
        "error"
      );
      return;
    }

    const participant = {
      id: createId(),
      name,
      password,
      roomId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    state.participants.push(participant);
    completeParticipantLogin(
      participant,
      `${name}さんを参加者として登録しました。`
    );
  }

  function openBookingDialog(roomId) {
    const participant = getCurrentParticipant();
    const targetRoom = getRoom(roomId);
    if (!participant || !targetRoom) return;

    if (getRoomMembers(targetRoom).length >= targetRoom.capacity) {
      showNotice("この部屋は満室です。", "error");
      renderAll();
      return;
    }

    const currentRoom = getRoom(participant.roomId);
    state.pendingRoomId = targetRoom.id;
    elements.dialogTitle.textContent = currentRoom
      ? "部屋を移動しますか？"
      : "この部屋を予約しますか？";
    elements.dialogMessage.textContent = currentRoom
      ? `${currentRoom.name}の予約を解除し、${targetRoom.name}へ移動します。`
      : `${targetRoom.name}を${participant.name}さんのお名前で予約します。`;
    elements.confirmBooking.textContent = currentRoom
      ? "移動を確定"
      : "予約を確定";
    elements.bookingDialog.showModal();
  }

  async function confirmBooking() {
    const participant = getCurrentParticipant();
    const targetRoom = getRoom(state.pendingRoomId);
    if (!participant || !targetRoom) {
      elements.bookingDialog.close();
      return;
    }

    if (getSupabaseSetupError()) {
      elements.bookingDialog.close();
      showNotice(getSupabaseSetupError(), "error");
      return;
    }

    if (!/^[0-9]{4}$/.test(String(participant.password || ""))) {
      elements.bookingDialog.close();
      showNotice("参加者の4桁パスワードを設定してから予約してください。", "error");
      return;
    }

    if (getRoomMembers(targetRoom).length >= targetRoom.capacity) {
      elements.bookingDialog.close();
      showNotice("操作中に満室になりました。別の部屋をお選びください。", "error");
      renderAll();
      return;
    }

    elements.confirmBooking.disabled = true;
    try {
      await deleteSupabaseReservationsForParticipant(participant);
      await insertSupabaseReservation(participant, targetRoom);
      participant.updatedAt = new Date().toISOString();
      state.pendingRoomId = null;
      elements.bookingDialog.close();
      await refreshSupabaseReservations();
      showNotice(`${targetRoom.name}の予約が完了しました。`);
    } catch (error) {
      showNotice(`予約の保存に失敗しました：${error.message}`, "error");
    } finally {
      elements.confirmBooking.disabled = false;
    }
  }

  function showAdminLogin() {
    elements.adminLoginView.hidden = false;
    elements.adminResetView.hidden = true;
    elements.adminResetComplete.hidden = true;
    elements.adminDashboard.hidden = true;
  }

  function showResetForm() {
    elements.adminLoginView.hidden = true;
    elements.adminResetView.hidden = false;
    elements.adminResetComplete.hidden = true;
    elements.adminDashboard.hidden = true;
  }

  function submitResetRequest(email) {
    const requests = safeParse(
      localStorage.getItem(STORAGE_KEYS.resetRequests),
      []
    );
    const request = {
      id: `reset-${Date.now()}`,
      email: email.trim().toLowerCase(),
      requestedAt: new Date().toISOString(),
      status: "requested",
    };
    requests.push(request);
    localStorage.setItem(STORAGE_KEYS.resetRequests, JSON.stringify(requests));

    if (request.email === state.admin.email.toLowerCase()) {
      state.admin.resetToken = `pending-${Date.now()}`;
      state.admin.resetRequestedAt = request.requestedAt;
      localStorage.setItem(STORAGE_KEYS.admin, JSON.stringify(state.admin));
    }

    elements.adminLoginView.hidden = true;
    elements.adminResetView.hidden = true;
    elements.adminResetComplete.hidden = false;
    elements.adminDashboard.hidden = true;
    elements.adminResetForm.reset();
  }

  $$(".tab-button").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });

  elements.headerMenuToggle.addEventListener("click", () => {
    const isOpen =
      elements.headerMenuToggle.getAttribute("aria-expanded") === "true";
    setHeaderMenuOpen(!isOpen);
  });

  elements.headerMenuPanel.addEventListener("click", (event) => {
    const menuItem = event.target.closest("[data-menu-action]");
    if (!menuItem) return;

    const action = menuItem.dataset.menuAction;
    setHeaderMenuOpen(false);

    if (action === "participant-login") {
      switchParticipantAuth("login");
      elements.participantAccess.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      window.setTimeout(() => elements.participantLoginName.focus(), 350);
      return;
    }

    if (action === "logout") {
      logoutFromHeaderMenu();
      return;
    }

    switchView(action);
    scrollToActiveView();
  });

  document.addEventListener("click", (event) => {
    const isOpen =
      elements.headerMenuToggle.getAttribute("aria-expanded") === "true";
    if (isOpen && !elements.headerMenu.contains(event.target)) {
      setHeaderMenuOpen(false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      elements.headerMenuToggle.getAttribute("aria-expanded") === "true"
    ) {
      setHeaderMenuOpen(false, true);
    }
  });

  elements.busSeatMaps.addEventListener("click", (event) => {
    const seatButton = event.target.closest("[data-bus-seat]");
    if (!seatButton || seatButton.disabled) return;
    if (!getCurrentParticipant()) return;

    const trip = seatButton.dataset.busTrip;
    const seatId = seatButton.dataset.busSeat;
    if (!state.busSelections[trip] || getReservedBusSeats(trip).has(seatId)) {
      return;
    }

    const selectedSeats = state.busSelections[trip];
    if (selectedSeats.has(seatId)) {
      selectedSeats.delete(seatId);
    } else {
      selectedSeats.clear();
      selectedSeats.add(seatId);
    }
    renderBusSeatMaps();
    renderBusSelectionSummary();
    showBusFormErrors([]);
    invalidateBusConfirmation();
  });

  elements.confirmBusReservation.addEventListener("click", () => {
    confirmBusReservation();
  });

  $$("[data-participant-auth]").forEach((button) => {
    button.addEventListener("click", () => {
      switchParticipantAuth(button.dataset.participantAuth);
    });
  });

  elements.participantLoginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    loginParticipant(
      elements.participantLoginName.value,
      elements.participantLoginPassword.value
    );
  });

  elements.participantRegisterForm.addEventListener("submit", (event) => {
    event.preventDefault();
    registerParticipant(
      elements.participantRegisterName.value,
      elements.participantRegisterPassword.value
    );
  });

  elements.participantLogout.addEventListener("click", () => {
    state.session.participantId = null;
    syncBusSelectionsWithCurrentParticipant();
    saveSession();
    renderAll();
    showNotice("参加者ログアウトしました。");
  });

  elements.roomGrid.addEventListener("click", (event) => {
    const galleryButton = event.target.closest("[data-gallery-direction]");
    if (galleryButton) {
      const gallery = galleryButton.closest("[data-room-gallery]");
      moveRoomGallery(gallery, Number(galleryButton.dataset.galleryDirection));
      return;
    }

    const button = event.target.closest("[data-book-room]");
    if (button && !button.disabled) {
      openBookingDialog(button.dataset.bookRoom);
    }
  });

  let gallerySwipe = null;
  elements.roomGrid.addEventListener(
    "touchstart",
    (event) => {
      const gallery = event.target.closest("[data-room-gallery]");
      const touch = event.touches[0];
      gallerySwipe =
        gallery && touch
          ? { gallery, startX: touch.clientX, startY: touch.clientY }
          : null;
    },
    { passive: true }
  );

  elements.roomGrid.addEventListener(
    "touchend",
    (event) => {
      if (!gallerySwipe) return;
      const touch = event.changedTouches[0];
      if (!touch) {
        gallerySwipe = null;
        return;
      }

      const deltaX = touch.clientX - gallerySwipe.startX;
      const deltaY = touch.clientY - gallerySwipe.startY;
      if (Math.abs(deltaX) > 42 && Math.abs(deltaX) > Math.abs(deltaY)) {
        moveRoomGallery(gallerySwipe.gallery, deltaX < 0 ? 1 : -1);
      }
      gallerySwipe = null;
    },
    { passive: true }
  );

  elements.confirmBooking.addEventListener("click", confirmBooking);

  elements.adminLoginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const email = $("#admin-email").value.trim().toLowerCase();
    const password = $("#admin-password").value;
    if (
      email === state.admin.email.toLowerCase() &&
      password === state.admin.password
    ) {
      state.session.adminAuthenticated = true;
      saveSession();
      elements.adminLoginForm.reset();
      renderAdmin();
      renderHeaderMenu();
      showNotice("管理者としてログインしました。");
    } else {
      showNotice(
        "メールアドレスまたはパスワードが正しくありません。",
        "error"
      );
    }
  });

  $("#show-reset").addEventListener("click", showResetForm);
  $("#back-to-admin-login").addEventListener("click", showAdminLogin);
  $("#reset-complete-back").addEventListener("click", showAdminLogin);

  elements.adminResetForm.addEventListener("submit", (event) => {
    event.preventDefault();
    submitResetRequest($("#reset-email").value);
  });

  elements.itineraryForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!state.session.adminAuthenticated) {
      showNotice("管理者としてログインしてください。", "error");
      return;
    }

    const date = elements.itineraryDate.value;
    const time = elements.itineraryTime.value;
    const title = elements.itineraryEntryTitle.value.trim();
    const location = elements.itineraryLocation.value.trim();
    const note = elements.itineraryNote.value.trim();

    if (!date || !time || !title) {
      showNotice("日付・時刻・予定を入力してください。", "error");
      return;
    }

    const now = new Date().toISOString();
    const existingEntry = state.itinerary.find(
      (entry) => entry.id === state.editingItineraryId
    );
    if (existingEntry) {
      Object.assign(existingEntry, {
        date,
        time,
        title,
        location,
        note,
        updatedAt: now,
      });
    } else {
      state.itinerary.push({
        id: `itinerary-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        date,
        time,
        title,
        location,
        note,
        createdAt: now,
        updatedAt: now,
      });
    }

    const message = existingEntry
      ? "工程を更新しました。"
      : "工程をしおりへ追加しました。";
    saveAll();
    resetItineraryEditor();
    renderItinerary();
    renderAdminItinerary();
    showNotice(message);
  });

  elements.cancelItineraryEdit.addEventListener("click", () => {
    resetItineraryEditor();
  });

  elements.adminItineraryList.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-itinerary-edit]");
    const deleteButton = event.target.closest("[data-itinerary-delete]");

    if (editButton) {
      const entry = state.itinerary.find(
        (item) => item.id === editButton.dataset.itineraryEdit
      );
      if (!entry) return;

      state.editingItineraryId = entry.id;
      elements.itineraryDate.value = entry.date;
      elements.itineraryTime.value = entry.time;
      elements.itineraryEntryTitle.value = entry.title;
      elements.itineraryLocation.value = entry.location || "";
      elements.itineraryNote.value = entry.note || "";
      elements.saveItinerary.textContent = "変更を保存";
      elements.cancelItineraryEdit.hidden = false;
      elements.itineraryForm.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      elements.itineraryEntryTitle.focus();
      return;
    }

    if (deleteButton) {
      const entry = state.itinerary.find(
        (item) => item.id === deleteButton.dataset.itineraryDelete
      );
      if (!entry) return;
      if (!window.confirm(`「${entry.title}」を工程表から削除しますか？`)) {
        return;
      }

      state.itinerary = state.itinerary.filter(
        (item) => item.id !== entry.id
      );
      if (state.editingItineraryId === entry.id) resetItineraryEditor();
      saveAll();
      renderItinerary();
      renderAdminItinerary();
      showNotice("工程を削除しました。");
    }
  });

  elements.adminParticipantAccountList.addEventListener("click", async (event) => {
    const deleteButton = event.target.closest("[data-delete-participant]");
    if (!deleteButton) return;

    if (!state.session.adminAuthenticated) {
      showNotice("管理者としてログインしてください。", "error");
      return;
    }

    const participant = state.participants.find(
      (item) => item.id === deleteButton.dataset.deleteParticipant
    );
    if (!participant) {
      showNotice("参加者情報が見つかりません。", "error");
      return;
    }

    if (
      !window.confirm(
        `${participant.name}さんのアカウントを削除しますか？\n部屋予約とバス座席予約も解除されます。`
      )
    ) {
      return;
    }

    try {
      if (participant.roomId && !getSupabaseSetupError()) {
        await deleteSupabaseReservationsForParticipant(participant);
      }

      state.rooms.forEach((room) => {
        room.participantIds = room.participantIds.filter(
          (participantId) => participantId !== participant.id
        );
      });
      state.participants = state.participants.filter(
        (item) => item.id !== participant.id
      );
      if (state.session.participantId === participant.id) {
        state.session.participantId = null;
        syncBusSelectionsWithCurrentParticipant();
      }

      saveAll();
      if (!getSupabaseSetupError()) {
        await refreshSupabaseReservations({ showErrors: false });
      } else {
        renderAll();
      }
      showNotice(`${participant.name}さんのアカウントを削除しました。`);
    } catch (error) {
      showNotice(`アカウント削除に失敗しました：${error.message}`, "error");
    }
  });

  elements.adminParticipantAccountList.addEventListener("submit", async (event) => {
    const form = event.target.closest("[data-participant-password-form]");
    if (!form) return;
    event.preventDefault();

    if (!state.session.adminAuthenticated) {
      showNotice("管理者としてログインしてください。", "error");
      return;
    }

    const input = form.querySelector("[data-participant-password-input]");
    const password = input.value.trim();
    if (!/^[0-9]{4}$/.test(password)) {
      input.setAttribute("aria-invalid", "true");
      showNotice("参加者パスワードは数字4桁で入力してください。", "error");
      return;
    }

    const participant = state.participants.find(
      (item) => item.id === form.dataset.participantId
    );
    if (!participant) {
      showNotice("参加者情報が見つかりません。", "error");
      return;
    }

    const oldPassword = participant.password;
    participant.password = password;
    participant.updatedAt = new Date().toISOString();

    try {
      await updateSupabasePinCode(participant);
      saveAll();
      renderAdmin();
      showNotice(`${participant.name}さんのパスワードを変更しました。`);
    } catch (error) {
      participant.password = oldPassword;
      showNotice(`パスワード変更に失敗しました：${error.message}`, "error");
    }
  });

  $("#admin-logout").addEventListener("click", () => {
    state.session.adminAuthenticated = false;
    saveSession();
    resetItineraryEditor();
    elements.adminParticipantAccountList.innerHTML = "";
    showAdminLogin();
    renderHeaderMenu();
    showNotice("管理者ログアウトしました。");
  });

  async function initializeApp() {
    loadState();
    syncBusSelectionsWithCurrentParticipant();
    renderAll();
    switchView("booking");
    await loadSupabaseReservations({ showErrors: true });
    syncBusSelectionsWithCurrentParticipant();
    renderAll();
  }

  initializeApp();
})();
