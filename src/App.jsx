import React, { useState, useEffect } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, collection, getDocs, writeBatch } from "firebase/firestore";
import { auth, db, createMemberAuthAccount } from "./firebaseConfig";
import {
  BookOpenText,
  Users,
  Wallet,
  HeartHandshake,
  Receipt,
  AlertCircle,
  Bell,
  Activity,
  Award,
  FileBarChart,
  Info,
  Phone,
  Mail,
  Star,
  ShieldCheck,
  ClipboardList,
  Menu,
  X,
  Settings,
  ArrowRight,
  Save,
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
  CheckCircle2,
  LogOut,
} from "lucide-react";

/* ============================================================
   ICON REGISTRY
   ------------------------------------------------------------
   Icons are referenced by a plain string key (not a component
   reference) so that a Card's "icon" field is DB/JSON-safe —
   a future Supabase row can only store a string, never a React
   component. ICON_MAP resolves that string to the actual icon
   both on the Home Page and inside the Admin Panel's picker.
   ============================================================ */
const ICON_MAP = {
  book: BookOpenText,
  users: Users,
  wallet: Wallet,
  heart: HeartHandshake,
  receipt: Receipt,
  alert: AlertCircle,
  bell: Bell,
  activity: Activity,
  award: Award,
  report: FileBarChart,
  info: Info,
  phone: Phone,
  star: Star,
  shield: ShieldCheck,
  list: ClipboardList,
};
const ICON_LABELS_UR = {
  book: "کتاب",
  users: "افراد",
  wallet: "بٹوہ",
  heart: "دل",
  receipt: "رسید",
  alert: "انتباہ",
  bell: "گھنٹی",
  activity: "سرگرمی",
  award: "ایوارڈ",
  report: "رپورٹ",
  info: "معلومات",
  phone: "فون",
  star: "ستارہ",
  shield: "شیلڈ",
  list: "فہرست",
};
const ICON_KEYS = Object.keys(ICON_MAP);

/* ============================================================
   DEFAULT / FUTURE-DB-BACKED CONFIGURATION
   ------------------------------------------------------------
   These three objects (SITE_CONFIG, CARD_REGISTRY, FUND_CONFIG)
   still have exactly the same shape as Phase 1A. The only change
   in Phase 1B Part A is WHERE they live: instead of being static
   module-level constants read directly by the page, they are now
   the *initial* values of React state in <App>, and the Admin
   Panel edits that same state. When a database is added later,
   these DEFAULT_* objects are simply replaced by a fetch call —
   nothing in the render logic below has to change.
   ============================================================ */

const DEFAULT_SITE_CONFIG = {
  orgName: "کوزتیراج ویلفیئر آرگنائزیشن", // legacy field, kept for compatibility
  orgNameUrdu: "کوزتیراج ویلفیئر آرگنائزیشن",
  orgNameEnglish: "Koztiraj Welfare Organization",
  shortName: "KWO",
  headerHeading: "کوزتیراج ویلفیئر آرگنائزیشن", // legacy field, unused since header now reads orgNameUrdu
  homeHeading: "خوش آمدید",
  homeSubheading:
    "ایک فلاحی برادری، جو مل کر بہتری کے لیے کام کرتی ہے۔ نیچے دیے گئے کسی بھی سیکشن پر جائیں۔",
  logoInitial: "ک", // legacy field, unused since header now uses shortName as monogram
  theme: {
    primary: "#0B4F3F",
    primaryDark: "#083B2F",
    primarySoft: "#E7EFE9",
    accent: "#B8862B",
    accentSoft: "#F4E9D2",
    background: "#FBF9F4",
    backgroundAlt: "#F5F0E3",
    surface: "#FFFFFF",
    textStrong: "#1F2A24",
    textMuted: "#5B6B62",
    border: "#E4DFCF",
  },
  footer: {
    aboutLine: "ایک شفاف اور فلاحی جذبے سے چلنے والی تنظیم۔",
    contactLabel: "رابطہ",
    contactPlaceholder: "فون / ای میل یہاں شامل ہوگا",
    copyrightLine: "تمام حقوق محفوظ ہیں۔",
  },
};

const DEFAULT_CARD_REGISTRY = [
  { id: "constitution", order: 1, visible: true, title: "دستور", text: "تنظیم کا آئین اور بنیادی اصول", icon: "book" },
  { id: "members", order: 2, visible: true, title: "ممبران", text: "فعال اور سابقہ ممبران کی تفصیل", icon: "users" },
  { id: "funds", order: 3, visible: true, title: "فنڈز", text: "ماہانہ فنڈ اور مالی ڈھانچہ", icon: "wallet" },
  { id: "donations", order: 4, visible: true, title: "عطیات", text: "اضافی عطیات کی تفصیل", icon: "heart" },
  { id: "expenses", order: 5, visible: true, title: "اخراجات", text: "تنظیم کے اخراجات کا ریکارڈ", icon: "receipt" },
  { id: "arrears", order: 6, visible: true, title: "بقایاجات", text: "زیرِ التوا واجبات کی فہرست", icon: "alert" },
  { id: "notices", order: 7, visible: true, title: "نوٹس", text: "اہم اعلانات اور اطلاعات", icon: "bell" },
  { id: "activities", order: 8, visible: true, title: "سرگرمیاں", text: "حالیہ اور آئندہ سرگرمیاں", icon: "activity" },
  { id: "appreciation", order: 9, visible: true, title: "حوصلہ افزائی", text: "نمایاں خدمات کا اعتراف", icon: "award" },
  { id: "reports", order: 10, visible: true, title: "رپورٹس", text: "مالی و انتظامی رپورٹس", icon: "report" },
  { id: "about", order: 11, visible: true, title: "تنظیم کا تعارف", text: "مقاصد اور پس منظر", icon: "info" },
  { id: "contact", order: 12, visible: true, title: "رابطہ", text: "ہم سے رابطہ کریں", icon: "phone" },
];

// Members are still a growable/shrinkable list, never a fixed number.
// Each member now carries the fields Members Management needs. "status"
// can be 'active' | 'inactive' | 'archived' — members are never deleted,
// only moved to 'archived' so their future financial history stays intact.
const DEFAULT_MEMBERS = Array.from({ length: 16 }, (_, i) => ({
  id: `member-${i + 1}`,
  memberId: `M-${String(i + 1).padStart(3, "0")}`,
  name: `رکن ${i + 1}`,
  contactNumber: "",
  joiningDate: "",
  photo: "",
  notes: "",
  status: "active",
  authUid: null, // Firebase Auth UID once a Member login account is linked (see createMemberAuthAccount)
}));

const DEFAULT_FUND_CONFIG = {
  monthlyFundAmount: 1000,
  currency: "روپے",
};

// No invented history — starts empty. Each entry is one member's payment
// for one month, with the required-fund amount SNAPSHOTTED at entry time
// (so changing FUND_CONFIG.monthlyFundAmount later never rewrites past
// history). "memberId" here refers to a member's stable internal `id`,
// so history survives even if that member later becomes inactive/archived.
const DEFAULT_PAYMENTS = [];

// Minimal audit trail for permanently deleted fund/payment entries.
// A deletion never removes anything from here — it only appends. Stored
// as its own field in the SAME existing kwo/data document (no structural
// change), same pattern as every other section.
const DEFAULT_PAYMENT_DELETION_LOG = []; // { id, paymentId, memberId, amount, deletedAt }

const MONTH_NAMES_UR = [
  "جنوری", "فروری", "مارچ", "اپریل", "مئی", "جون",
  "جولائی", "اگست", "ستمبر", "اکتوبر", "نومبر", "دسمبر",
];

// No invented history — starts empty. "status" is 'active' | 'archived';
// expenses are never deleted, only archived (kept for audit, excluded
// from totals), same pattern as Members and Payments records.
const DEFAULT_EXPENSES = [];

/* ============================================================
   DASTOOR / CONSTITUTION — Chapters & Clauses
   ------------------------------------------------------------
   Kept as two flat arrays (not nested) so each clause has its
   own stable `id` that can be referenced independently later —
   from Notices, from search results, or from a generated PDF's
   table of contents — without having to walk a nested tree to
   find it. "chapterId" is the link between the two.

   Numbering (باب 1، دفعہ 1.1 …) is never stored — it's always
   derived at render time from `order` among non-archived items,
   so reordering or archiving never leaves numbering gaps or
   requires renumbering stored data.

   Starts empty — no data is carried over from any old website.
   ============================================================ */
const DEFAULT_DASTOOR_CHAPTERS = []; // { id, order, status: 'active' | 'archived', title }
const DEFAULT_DASTOOR_CLAUSES = []; // { id, chapterId, order, status: 'active' | 'archived', title, text }

/* ============================================================
   NOTICES
   ------------------------------------------------------------
   "dastoorRef" stores only { chapterId, clauseId } — never a
   copy of the chapter/clause title or text — so the reference
   always reflects the live Dastoor content and the two datasets
   never drift apart. clauseId may be null (whole-chapter reference).

   "recipientMode": 'all' | 'selected' | 'single'. For 'all' no
   member ids are stored — the audience is computed as "whichever
   members are active right now" at render time, so it never goes
   stale as membership changes. 'selected'/'single' store specific
   member ids in recipientMemberIds.

   Public visibility rule: only status === 'published' AND
   recipientMode === 'all' notices are shown on the public Notices
   page — anything targeted at specific members is private and
   only visible from Notices Management (no auth yet to gate it
   per-member).
   ============================================================ */
const NOTICE_TYPES = ["عام Notice", "Fund Reminder", "Warning", "Suspension", "دیگر"];
const DEFAULT_NOTICES = []; // { id, title, type, date, text, status: 'draft'|'published'|'archived', notes, recipientMode, recipientMemberIds, dastoorRef }

/* ============================================================
   ACTIVITIES / سرگرمیاں
   ------------------------------------------------------------
   Same never-delete pattern as Notices: 'draft' | 'published' |
   'archived'. imageUrls is a plain array of strings (no upload/
   storage backend yet — just references), so adding real image
   uploads later only changes how a URL gets into this array.
   ============================================================ */
const DEFAULT_ACTIVITIES = []; // { id, title, date, description, imageUrls: string[], status: 'draft'|'published'|'archived' }

/* ============================================================
   ENCOURAGEMENT / حوصلہ افزائی
   ------------------------------------------------------------
   Each record references a member by `memberId` (the member's
   stable internal id from Members Management) — the member's
   name/photo are never copied here, always looked up live.

   "showFinancialContribution" is just a boolean flag. When true,
   the public/admin views sum that member's already-computed
   `paidFund`/`donation` fields straight out of the existing
   `payments` array (from FundsManagement) — no new financial
   calculation is introduced, and nothing is duplicated/stored.
   ============================================================ */
const ACHIEVEMENT_TYPES = ["مالی حصہ (Financial)", "رضاکارانہ خدمات (Volunteer Service)", "تنظیمی خدمات (Organizational Service)", "دیگر (Other)"];
const DEFAULT_ACHIEVEMENTS = []; // { id, memberId, title, description, period, type, order, showFinancialContribution, status: 'draft'|'published'|'archived' }

/* ============================================================
   LIMITED ADMIN ROLES — section keys
   ------------------------------------------------------------
   "settings" covers the Admin Panel's own branding/theme/home
   headings/cards/monthly-fund-amount forms. The rest match the
   existing admin view names 1:1.
   ============================================================ */
const SECTION_KEYS = [
  "settings", "members", "funds", "expenses", "summary", "reports-admin",
  "dastoor-admin", "notices-admin", "activities-admin", "achievements-admin", "contact-admin",
];
const SECTION_LABELS_UR = {
  settings: "ویب سائٹ سیٹنگز (برانڈنگ/تھیم/کارڈز/فنڈ رقم)",
  members: "ممبران کا انتظام",
  funds: "فنڈز کا انتظام",
  expenses: "اخراجات کا انتظام",
  summary: "مالی خلاصہ",
  "reports-admin": "رپورٹس",
  "dastoor-admin": "دستور کا انتظام",
  "notices-admin": "نوٹسز کا انتظام",
  "activities-admin": "سرگرمیوں کا انتظام",
  "achievements-admin": "حوصلہ افزائی کا انتظام",
  "contact-admin": "رابطہ معلومات",
};

/* ============================================================
   CONTACT INFORMATION (Phase 1 — Contact Information Management)
   ------------------------------------------------------------
   Stored as its own array under contactInfo in the SAME existing
   kwo/data Firestore document — merged in via persist({contactInfo})
   just like every other section, so the document structure isn't
   restructured. Each entry: { id, type: 'phone'|'email', value,
   label, status: 'active'|'archived' }. "Remove" here is a real
   delete (not archive) since these are simple contact entries, not
   financial/audit records — matches the plain "add/edit/remove"
   requirement. Existing siteConfig.footer.contactLabel/
   contactPlaceholder fields are left completely untouched.
   ============================================================ */
const DEFAULT_CONTACT_INFO = [];

/* ============================================================
   CORE FUND / DONATION / ARREARS LOGIC
   ------------------------------------------------------------
   Pure function, no hard-coded amounts — always driven by the
   configurable "requiredFund" (a snapshot of FUND_CONFIG at the
   time of entry), exactly per the agreed rule:
     paid >= required  → paidFund = required, donation = paid - required, arrears = 0
     paid <  required  → paidFund = paid,     donation = 0,               arrears = required - paid
   ============================================================ */
function computeFundBreakdown(paidAmount, requiredFund) {
  const paid = Number(paidAmount) || 0;
  const required = Number(requiredFund) || 0;
  if (paid >= required) {
    return { paidFund: required, donation: paid - required, arrears: 0 };
  }
  return { paidFund: paid, donation: 0, arrears: required - paid };
}

/* ============================================================
   APP ROOT — holds the "database" as React state for now.
   Switches between the public Home Page, the Admin Panel, and
   the Members Management screen.
   ============================================================ */
export default function App() {
  const [view, setView] = useState("home"); // 'home' | 'admin' | 'members' | 'funds' | 'expenses' | 'summary' | 'dastoor-admin' | 'notices-admin' | 'activities-admin' | 'achievements-admin' | 'reports-admin'
  const [siteConfig, setSiteConfig] = useState(DEFAULT_SITE_CONFIG);
  const [cardRegistry, setCardRegistry] = useState(DEFAULT_CARD_REGISTRY);
  const [fundConfig, setFundConfig] = useState(DEFAULT_FUND_CONFIG);
  const [members, setMembers] = useState(DEFAULT_MEMBERS);
  const [payments, setPayments] = useState(DEFAULT_PAYMENTS);
  const [paymentDeletionLog, setPaymentDeletionLog] = useState(DEFAULT_PAYMENT_DELETION_LOG);
  const [expenses, setExpenses] = useState(DEFAULT_EXPENSES);
  const [dastoorChapters, setDastoorChapters] = useState(DEFAULT_DASTOOR_CHAPTERS);
  const [dastoorClauses, setDastoorClauses] = useState(DEFAULT_DASTOOR_CLAUSES);
  const [notices, setNotices] = useState(DEFAULT_NOTICES);
  const [activities, setActivities] = useState(DEFAULT_ACTIVITIES);
  const [achievements, setAchievements] = useState(DEFAULT_ACHIEVEMENTS);
  const [contactInfo, setContactInfo] = useState(DEFAULT_CONTACT_INFO);

  /* ---- Firebase Authentication (Admin Panel gate) ----
     `authUser` is null until Firebase reports the real state (either
     "signed in" or "signed out") — `authLoading` distinguishes "we
     don't know yet" from "definitely signed out", so a page refresh
     doesn't briefly flash the login screen for an already-logged-in
     Super Admin. */
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setAuthUser(u);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  /* ---- Limited Admin roles ----
     Role assignment lives in Firestore: adminRoles/{uid} → { email,
     role: 'super_admin' | 'limited_admin', sections: [...], active }.
     If NO role doc exists for a signed-in user, they are treated as
     'super_admin' with access to everything — this preserves the
     existing single-admin account's access exactly as it was before
     this feature existed, so nobody gets locked out. A role doc is
     only needed when you deliberately want to LIMIT someone.

     IMPORTANT HONESTY NOTE: this only controls what the UI shows.
     The actual Firestore security rule for the "kwo/data" document
     currently just checks "is this user signed in at all" — it does
     not yet enforce per-section write permissions at the database
     level (that would require splitting kwo/data into separate
     documents/collections with matching rules, which hasn't been
     done). So a Limited Admin who is technically comfortable enough
     to call the Firestore API directly could still write outside
     their assigned sections. This is safe for keeping normal admins
     within their assigned areas of the app, but is not yet a hard
     security boundary. */
  const [adminRole, setAdminRole] = useState(null);
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    async function loadRole() {
      if (!authUser) {
        setAdminRole(null);
        setRoleLoading(false);
        return;
      }
      setRoleLoading(true);
      try {
        const snap = await getDoc(doc(db, "adminRoles", authUser.uid));
        if (snap.exists()) {
          setAdminRole(snap.data());
        } else {
          // SECURITY: "no role doc" must NOT automatically mean super_admin.
          // That fallback was only ever safe while the ONLY people who
          // could sign in at all were admins. Now that Active Members can
          // also get their own Firebase Auth accounts, an authenticated
          // Member with no adminRoles doc must NOT fall through to full
          // Admin Panel access. The one narrow exception kept here: if the
          // adminRoles collection is COMPLETELY empty (nobody has ever been
          // registered as an admin yet), the very first signed-in user is
          // treated as super_admin once, so the site's original owner is
          // never locked out of their own Admin Panel. The moment even one
          // adminRoles doc exists, this exception stops applying to anyone
          // else — which is exactly why, the first time you sign in after
          // this update, you should immediately open Admin Panel → Admin
          // Users and add YOURSELF explicitly as super_admin, before
          // creating any Member accounts.
          const existingRoles = await getDocs(collection(db, "adminRoles"));
          if (existingRoles.empty) {
            setAdminRole({ role: "super_admin", sections: SECTION_KEYS, active: true });
          } else {
            setAdminRole({ role: "none", sections: [], active: false });
          }
        }
      } catch (err) {
        console.error("Failed to load admin role:", err);
        // Fail CLOSED, not open — an error while checking permissions must
        // never be treated as "so let them in".
        setAdminRole({ role: "none", sections: [], active: false });
      }
      setRoleLoading(false);
    }
    loadRole();
  }, [authUser]);

  /* ---- Firestore persistence ----
     Everything lives in ONE document: kwo/data. That keeps every
     existing Admin screen's code untouched — they already lift
     their changes up via onApply(...); we only add a Firestore
     write alongside each existing setXxx call, and one read on
     first load. Public visitors can read this document (so the
     Home Page, Dastoor, Notices, Activities, Encouragement all
     show real content without logging in) — only a signed-in
     Admin can write to it (enforced by Firestore security rules
     in the Firebase Console, not by this code). */
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const snap = await getDoc(doc(db, "kwo", "data"));
        if (snap.exists()) {
          const d = snap.data();
          if (d.siteConfig) setSiteConfig(d.siteConfig);
          if (d.cardRegistry) setCardRegistry(d.cardRegistry);
          if (d.fundConfig) setFundConfig(d.fundConfig);
          if (d.members) setMembers(d.members);
          if (d.payments) setPayments(d.payments);
          if (d.paymentDeletionLog) setPaymentDeletionLog(d.paymentDeletionLog);
          if (d.expenses) setExpenses(d.expenses);
          if (d.dastoorChapters) setDastoorChapters(d.dastoorChapters);
          if (d.dastoorClauses) setDastoorClauses(d.dastoorClauses);
          if (d.notices) setNotices(d.notices);
          if (d.activities) setActivities(d.activities);
          if (d.achievements) setAchievements(d.achievements);
          if (d.contactInfo) setContactInfo(d.contactInfo);
        }
      } catch (err) {
        console.error("Firestore load failed:", err);
      }
      setDataLoaded(true);
    }
    loadData();
  }, []);

  async function persist(partial) {
    try {
      await setDoc(doc(db, "kwo", "data"), partial, { merge: true });
    } catch (err) {
      console.error("Firestore save failed:", err);
    }
  }

  /* ---- STEP 1 of the Member-privacy migration: additive mirroring ----
     Writes a COPY of each member/payment into its own top-level Firestore
     document (members/{id}, payments/{id}) — completely additive. The
     app still reads everything from kwo/data exactly as before; nothing
     about current behavior changes. This only starts building up the
     standalone collections that a future, carefully-tested security rule
     will actually protect. Safe to run repeatedly — it's just an
     overwrite-with-latest-data mirror, never a delete of kwo/data.
     Deleting a payment (which the app DOES already support) also deletes
     its mirrored copy, so the two never drift apart. */
  async function mirrorMembersToCollection(memberList) {
    try {
      const batch = writeBatch(db);
      memberList.forEach((m) => {
        batch.set(doc(db, "members", m.id), m);
      });
      await batch.commit();
    } catch (err) {
      console.error("Member mirroring to standalone collection failed:", err);
    }
  }

  async function mirrorPaymentsToCollection(paymentList, deletedIds) {
    try {
      const batch = writeBatch(db);
      paymentList.forEach((p) => {
        batch.set(doc(db, "payments", p.id), p);
      });
      (deletedIds || []).forEach((id) => {
        batch.delete(doc(db, "payments", id));
      });
      await batch.commit();
    } catch (err) {
      console.error("Payment mirroring to standalone collection failed:", err);
    }
  }

  if (!dataLoaded) {
    return <AuthLoadingScreen theme={DEFAULT_SITE_CONFIG.theme} />;
  }

  function applyChanges(next) {
    setSiteConfig(next.siteConfig);
    setCardRegistry(next.cardRegistry);
    setFundConfig(next.fundConfig);
    persist({ siteConfig: next.siteConfig, cardRegistry: next.cardRegistry, fundConfig: next.fundConfig });
  }

  const ADMIN_ONLY_VIEWS = new Set([
    "admin", "admin-users", "members", "funds", "expenses", "summary", "reports-admin",
    "dastoor-admin", "notices-admin", "activities-admin", "achievements-admin", "contact-admin",
  ]);
  const VIEW_TO_SECTION = {
    members: "members", funds: "funds", expenses: "expenses", summary: "summary",
    "reports-admin": "reports-admin", "dastoor-admin": "dastoor-admin",
    "notices-admin": "notices-admin", "activities-admin": "activities-admin",
    "achievements-admin": "achievements-admin", "contact-admin": "contact-admin",
  };

  if (ADMIN_ONLY_VIEWS.has(view)) {
    if (authLoading || roleLoading) {
      return <AuthLoadingScreen theme={siteConfig.theme} />;
    }
    if (!authUser) {
      return (
        <LoginScreen
          theme={siteConfig.theme}
          orgNameUrdu={siteConfig.orgNameUrdu}
          onBackToSite={() => setView("home")}
          message={view === "funds" ? "فنڈ کی تفصیلات صرف فعال اراکین اور مجاز منتظمین کے لیے دستیاب ہیں۔" : undefined}
        />
      );
    }
    const isSuperAdmin = !adminRole || adminRole.role === "super_admin";
    const isActive = !adminRole || adminRole.active !== false;
    if (!isActive) {
      return (
        <AccessDeniedScreen
          theme={siteConfig.theme}
          message="آپ کے اکاؤنٹ کی رسائی فی الحال معطل ہے۔ Super Admin سے رابطہ کریں۔"
          onBack={() => setView("home")}
          onLogout={() => { signOut(auth); setView("home"); }}
        />
      );
    }
    if (view === "admin-users" && !isSuperAdmin) {
      return (
        <AccessDeniedScreen
          theme={siteConfig.theme}
          message="یہ حصہ صرف Super Admin کے لیے ہے۔"
          onBack={() => setView("admin")}
          onLogout={() => { signOut(auth); setView("home"); }}
        />
      );
    }
    const neededSection = VIEW_TO_SECTION[view];
    if (neededSection && !isSuperAdmin && !(adminRole.sections || []).includes(neededSection)) {
      return (
        <AccessDeniedScreen
          theme={siteConfig.theme}
          message="اس حصے تک آپ کی رسائی نہیں ہے۔"
          onBack={() => setView("admin")}
          onLogout={() => { signOut(auth); setView("home"); }}
        />
      );
    }
  }

  if (view === "admin") {
    const isSuperAdmin = !adminRole || adminRole.role === "super_admin";
    return (
      <AdminPanel
        siteConfig={siteConfig}
        cardRegistry={cardRegistry}
        fundConfig={fundConfig}
        onApply={applyChanges}
        onBack={() => setView("home")}
        onLogout={() => { signOut(auth); setView("home"); }}
        isSuperAdmin={isSuperAdmin}
        allowedSections={adminRole ? adminRole.sections || [] : SECTION_KEYS}
        onOpenAdminUsers={() => setView("admin-users")}
        onOpenMembers={() => setView("members")}
        onOpenFunds={() => setView("funds")}
        onOpenExpenses={() => setView("expenses")}
        onOpenSummary={() => setView("summary")}
        onOpenReports={() => setView("reports-admin")}
        onOpenDastoor={() => setView("dastoor-admin")}
        onOpenNotices={() => setView("notices-admin")}
        onOpenActivities={() => setView("activities-admin")}
        onOpenAchievements={() => setView("achievements-admin")}
        onOpenContact={() => setView("contact-admin")}
        onMigrateNow={async () => {
          await mirrorMembersToCollection(members);
          await mirrorPaymentsToCollection(payments, []);
        }}
      />
    );
  }

  if (view === "admin-users") {
    return (
      <AdminUsersManagement
        theme={siteConfig.theme}
        onBack={() => setView("admin")}
      />
    );
  }

  if (view === "contact-admin") {
    return (
      <ContactManagement
        theme={siteConfig.theme}
        contactInfo={contactInfo}
        onApply={(nextContactInfo) => { setContactInfo(nextContactInfo); persist({ contactInfo: nextContactInfo }); }}
        onBack={() => setView("admin")}
      />
    );
  }

  if (view === "members") {
    return (
      <MembersManagement
        theme={siteConfig.theme}
        members={members}
        onApply={(nextMembers) => {
          setMembers(nextMembers);
          persist({ members: nextMembers });
          mirrorMembersToCollection(nextMembers);
        }}
        onBack={() => setView("admin")}
      />
    );
  }

  if (view === "funds") {
    return (
      <FundsManagement
        theme={siteConfig.theme}
        members={members}
        fundConfig={fundConfig}
        payments={payments}
        deletionLog={paymentDeletionLog}
        onApply={(nextPayments, nextDeletionLog) => {
          const nextIds = new Set(nextPayments.map((p) => p.id));
          const deletedIds = payments.filter((p) => !nextIds.has(p.id)).map((p) => p.id);
          setPayments(nextPayments);
          setPaymentDeletionLog(nextDeletionLog);
          persist({ payments: nextPayments, paymentDeletionLog: nextDeletionLog });
          mirrorPaymentsToCollection(nextPayments, deletedIds);
        }}
        onBack={() => setView("admin")}
      />
    );
  }

  if (view === "expenses") {
    return (
      <ExpensesManagement
        theme={siteConfig.theme}
        expenses={expenses}
        currency={fundConfig.currency}
        onApply={(nextExpenses) => { setExpenses(nextExpenses); persist({ expenses: nextExpenses }); }}
        onBack={() => setView("admin")}
      />
    );
  }

  if (view === "summary") {
    return (
      <FinancialSummary
        theme={siteConfig.theme}
        payments={payments}
        expenses={expenses}
        currency={fundConfig.currency}
        onBack={() => setView("admin")}
      />
    );
  }

  if (view === "reports-admin") {
    return (
      <ReportsManagement
        theme={siteConfig.theme}
        orgName={siteConfig.orgNameUrdu}
        orgNameEnglish={siteConfig.orgNameEnglish}
        shortName={siteConfig.shortName}
        members={members}
        payments={payments}
        expenses={expenses}
        currency={fundConfig.currency}
        onBack={() => setView("admin")}
      />
    );
  }

  if (view === "dastoor-admin") {
    return (
      <DastoorManagement
        theme={siteConfig.theme}
        chapters={dastoorChapters}
        clauses={dastoorClauses}
        onApply={(nextChapters, nextClauses) => {
          setDastoorChapters(nextChapters);
          setDastoorClauses(nextClauses);
          persist({ dastoorChapters: nextChapters, dastoorClauses: nextClauses });
        }}
        onBack={() => setView("admin")}
      />
    );
  }

  if (view === "notices-admin") {
    return (
      <NoticesManagement
        theme={siteConfig.theme}
        notices={notices}
        members={members}
        dastoorChapters={dastoorChapters}
        dastoorClauses={dastoorClauses}
        onApply={(nextNotices) => { setNotices(nextNotices); persist({ notices: nextNotices }); }}
        onBack={() => setView("admin")}
      />
    );
  }

  if (view === "activities-admin") {
    return (
      <ActivitiesManagement
        theme={siteConfig.theme}
        activities={activities}
        onApply={(nextActivities) => { setActivities(nextActivities); persist({ activities: nextActivities }); }}
        onBack={() => setView("admin")}
      />
    );
  }

  if (view === "achievements-admin") {
    return (
      <AchievementsManagement
        theme={siteConfig.theme}
        achievements={achievements}
        members={members}
        payments={payments}
        onApply={(nextAchievements) => { setAchievements(nextAchievements); persist({ achievements: nextAchievements }); }}
        onBack={() => setView("admin")}
      />
    );
  }

  const openCard = cardRegistry.find((c) => c.id === view);
  if (openCard && openCard.id === "constitution") {
    return (
      <DastoorPage
        theme={siteConfig.theme}
        card={openCard}
        chapters={dastoorChapters}
        clauses={dastoorClauses}
        onBack={() => setView("home")}
      />
    );
  }
  if (openCard && openCard.id === "notices") {
    return (
      <NoticesPage
        theme={siteConfig.theme}
        card={openCard}
        notices={notices}
        dastoorChapters={dastoorChapters}
        dastoorClauses={dastoorClauses}
        onBack={() => setView("home")}
      />
    );
  }
  if (openCard && openCard.id === "activities") {
    return (
      <ActivitiesPage
        theme={siteConfig.theme}
        card={openCard}
        activities={activities}
        onBack={() => setView("home")}
      />
    );
  }
  if (openCard && openCard.id === "appreciation") {
    return (
      <EncouragementPage
        theme={siteConfig.theme}
        card={openCard}
        achievements={achievements}
        members={members}
        payments={payments}
        currency={fundConfig.currency}
        onBack={() => setView("home")}
      />
    );
  }
  if (openCard) {
    return <CardPage theme={siteConfig.theme} card={openCard} onBack={() => setView("home")} />;
  }

  return (
    <HomePage
      siteConfig={siteConfig}
      cardRegistry={cardRegistry}
      fundConfig={fundConfig}
      members={members}
      contactInfo={contactInfo}
      onOpenAdmin={() => setView("admin")}
      onOpenCard={(cardId) => setView(cardId)}
    />
  );
}

/* ============================================================
   PUBLIC HOME PAGE (Phase 1A design, unchanged — now reads its
   data from props instead of module-level constants)
   ============================================================ */
function HomePage({ siteConfig, cardRegistry, fundConfig, members, contactInfo, onOpenAdmin, onOpenCard }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { theme } = siteConfig;

  const visibleCards = [...cardRegistry].filter((c) => c.visible).sort((a, b) => a.order - b.order);
  const navItems = [...cardRegistry].filter((c) => c.visible).sort((a, b) => a.order - b.order);

  const memberStats = {
    total: members.length,
    active: members.filter((m) => m.status === "active").length,
    inactive: members.filter((m) => m.status === "inactive").length,
  };

  return (
    <div
      dir="rtl"
      lang="ur"
      style={{
        background: `linear-gradient(180deg, ${theme.background} 0%, ${theme.backgroundAlt} 100%)`,
        color: theme.textStrong,
        fontFamily: "'Noto Naskh Arabic', serif",
        minHeight: "100vh",
        position: "relative",
        overflowX: "hidden",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400..700&family=Noto+Naskh+Arabic:wght@400..700&display=swap');

        .kw-heading { font-family: 'Noto Nastaliq Urdu', serif; }

        .kw-shape {
          position: absolute;
          border-radius: 50%;
          filter: blur(50px);
          pointer-events: none;
          z-index: 0;
        }

        .kw-diamond-row {
          background-image: repeating-linear-gradient(
            135deg,
            ${theme.accent} 0px,
            ${theme.accent} 2px,
            transparent 2px,
            transparent 14px
          );
          height: 4px;
          opacity: 0.55;
        }

        .kw-card-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          position: relative;
          z-index: 1;
        }
        @media (min-width: 640px) {
          .kw-card-grid { grid-template-columns: repeat(3, 1fr); gap: 14px; }
        }
        @media (min-width: 1024px) {
          .kw-card-grid { grid-template-columns: repeat(4, 1fr); gap: 16px; }
        }

        .kw-card {
          transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease, background 0.16s ease;
          box-shadow: 0 1px 2px rgba(31, 42, 36, 0.06);
          position: relative;
          overflow: hidden;
        }
        .kw-card::before {
          content: "";
          position: absolute;
          inset: 0 0 auto 0;
          height: 3px;
          background: linear-gradient(90deg, ${theme.primary}, ${theme.accent});
          opacity: 0.5;
        }
        .kw-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 22px rgba(11, 79, 63, 0.16);
          border-color: ${theme.accent};
        }
        .kw-card:active {
          transform: translateY(-1px) scale(0.99);
          box-shadow: 0 6px 14px rgba(11, 79, 63, 0.14);
        }
        .kw-card:focus-visible {
          outline: 3px solid ${theme.accent};
          outline-offset: 2px;
        }
        .kw-card:hover .kw-card-badge {
          background: ${theme.primary};
          color: #FBF9F4;
        }

        .kw-navlink { position: relative; }
        .kw-navlink::after {
          content: "";
          position: absolute;
          right: 0;
          bottom: -4px;
          width: 0%;
          height: 2px;
          background: ${theme.accent};
          transition: width 0.2s ease;
        }
        .kw-navlink:hover::after { width: 100%; }

        .kw-admin-fab {
          transition: transform 0.16s ease, box-shadow 0.16s ease;
        }
        .kw-admin-fab:hover { transform: translateY(-2px); }

        @media (prefers-reduced-motion: reduce) {
          .kw-card, .kw-navlink::after, .kw-admin-fab { transition: none !important; }
        }
      `}</style>

      {/* ---------------- HEADER ---------------- */}
      <header
        style={{
          background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryDark} 100%)`,
          color: "#FBF9F4",
          position: "sticky",
          top: 0,
          zIndex: 30,
        }}
      >
        <div
          style={{
            maxWidth: 1120,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 18px",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <div
              aria-hidden="true"
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: `linear-gradient(155deg, ${theme.accent} 0%, #9C6E1F 100%)`,
                color: theme.primaryDark,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "'Noto Naskh Arabic', serif",
                fontSize: 15,
                fontWeight: 700,
                letterSpacing: "0.5px",
                flexShrink: 0,
                boxShadow: "0 2px 6px rgba(0,0,0,0.18)",
                border: "1px solid rgba(255,255,255,0.25)",
              }}
            >
              {siteConfig.shortName}
            </div>
            <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
              <h1
                className="kw-heading"
                style={{ fontSize: "1.08rem", fontWeight: 700, lineHeight: 1.35, margin: 0, whiteSpace: "normal" }}
              >
                {siteConfig.orgNameUrdu}
              </h1>
              <span
                style={{
                  fontFamily: "'Noto Naskh Arabic', serif",
                  fontSize: "0.66rem",
                  color: "rgba(251,249,244,0.78)",
                  letterSpacing: "0.4px",
                  lineHeight: 1.3,
                }}
              >
                {siteConfig.orgNameEnglish}
              </span>
            </div>
          </div>

          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? "مینو بند کریں" : "مینو کھولیں"}
            aria-expanded={menuOpen}
            style={{ background: "transparent", border: "none", color: "#FBF9F4", padding: 8, cursor: "pointer", display: "block", flexShrink: 0 }}
            className="md-hide"
          >
            {menuOpen ? <X size={26} /> : <Menu size={26} />}
          </button>

          <nav aria-label="بنیادی مینو" className="kw-desktop-nav" style={{ display: "none", flexShrink: 0 }}>
            <ul style={{ display: "flex", gap: 22, listStyle: "none", margin: 0, padding: 0 }}>
              {navItems.slice(0, 6).map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => onOpenCard(item.id)}
                    className="kw-navlink"
                    style={{ background: "none", border: "none", color: "#FBF9F4", textDecoration: "none", fontSize: "0.95rem", fontFamily: "inherit", cursor: "pointer", padding: 0 }}
                  >
                    {item.title}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {menuOpen && (
          <nav aria-label="موبائل مینو" style={{ background: theme.primaryDark, padding: "10px 18px 18px" }}>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
              {navItems.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenCard(item.id);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#FBF9F4",
                      textDecoration: "none",
                      display: "block",
                      width: "100%",
                      textAlign: "start",
                      padding: "8px 4px",
                      fontSize: "0.98rem",
                      fontFamily: "inherit",
                      cursor: "pointer",
                      borderBottom: "1px solid rgba(251,249,244,0.12)",
                    }}
                  >
                    {item.title}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <div className="kw-diamond-row" />
      </header>

      {/* ---------------- HOME / HERO ---------------- */}
      <main style={{ maxWidth: 1120, margin: "0 auto", padding: "36px 18px 90px", position: "relative" }}>
        <div aria-hidden="true" className="kw-shape" style={{ width: 260, height: 260, top: -40, insetInlineEnd: -60, background: theme.accentSoft, opacity: 0.55 }} />
        <div aria-hidden="true" className="kw-shape" style={{ width: 220, height: 220, top: 60, insetInlineStart: -70, background: theme.primarySoft, opacity: 0.6 }} />

        <section style={{ textAlign: "center", marginBottom: 34, position: "relative", zIndex: 1 }}>
          <h2 className="kw-heading" style={{ fontSize: "2rem", color: theme.primary, margin: "0 0 12px", lineHeight: 1.4 }}>
            {siteConfig.homeHeading}
          </h2>
          <div
            aria-hidden="true"
            style={{ width: 64, height: 3, margin: "0 auto 16px", borderRadius: 999, background: `linear-gradient(90deg, ${theme.primary}, ${theme.accent})` }}
          />
          <p style={{ color: theme.textMuted, maxWidth: 560, margin: "0 auto", fontSize: "1rem", lineHeight: 2 }}>
            {siteConfig.homeSubheading}
          </p>
        </section>

        {/* ---------------- CARD GRID ---------------- */}
        <section aria-label="اہم سیکشنز" style={{ position: "relative", zIndex: 1 }}>
          <div className="kw-card-grid">
            {visibleCards.map((card) => {
              const Icon = ICON_MAP[card.icon] || Info;
              return (
                <button
                  key={card.id}
                  onClick={() => onOpenCard(card.id)}
                  className="kw-card"
                  style={{
                    background: theme.surface,
                    border: `1px solid ${theme.border}`,
                    borderRadius: 16,
                    padding: "14px",
                    textDecoration: "none",
                    color: theme.textStrong,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    minHeight: 108,
                    width: "100%",
                    textAlign: "start",
                    fontFamily: "inherit",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      aria-hidden="true"
                      className="kw-card-badge"
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        background: "rgba(11,79,63,0.08)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: theme.primary,
                        flexShrink: 0,
                        transition: "background 0.16s ease, color 0.16s ease",
                      }}
                    >
                      <Icon size={19} strokeWidth={1.9} />
                    </div>
                    <h3 className="kw-heading" style={{ fontSize: "1.02rem", margin: 0, color: theme.primary, lineHeight: 1.3 }}>
                      {card.title}
                    </h3>
                  </div>
                  <p style={{ margin: 0, fontSize: "0.8rem", color: theme.textMuted, lineHeight: 1.7 }}>{card.text}</p>

                  {card.id === "members" && (
                    <div style={{ marginTop: 2, paddingTop: 8, borderTop: `1px dashed ${theme.border}`, fontSize: "0.78rem", color: theme.textStrong, display: "flex", flexDirection: "column", gap: 3 }}>
                      <span>کل ممبران: <strong style={{ color: theme.primary }}>{memberStats.total}</strong></span>
                      <span style={{ color: theme.textMuted }}>
                        فعال: <strong style={{ color: theme.primary }}>{memberStats.active}</strong>
                        {" | "}
                        غیر فعال: <strong style={{ color: theme.primary }}>{memberStats.inactive}</strong>
                      </span>
                    </div>
                  )}

                  {card.id === "funds" && (
                    <div style={{ marginTop: 2, paddingTop: 8, borderTop: `1px dashed ${theme.border}`, fontSize: "0.78rem", color: theme.textMuted }}>
                      فنڈ کی تفصیلات صرف فعال اراکین اور مجاز منتظمین کے لیے دستیاب ہیں۔
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      </main>

      {/* ---------------- FOOTER ---------------- */}
      <footer style={{ background: theme.primaryDark, color: "#EFEBDD" }}>
        <div className="kw-diamond-row" />
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "26px 18px", display: "grid", gap: 14, textAlign: "center" }}>
          <h4 className="kw-heading" style={{ margin: 0, fontSize: "1.1rem" }}>{siteConfig.orgNameUrdu}</h4>
          <p style={{ margin: 0, fontSize: "0.9rem", color: "#C9C6B6" }}>{siteConfig.footer.aboutLine}</p>
          <p style={{ margin: 0, fontSize: "0.88rem", color: "#C9C6B6" }}>
            {siteConfig.footer.contactLabel}: {siteConfig.footer.contactPlaceholder}
          </p>

          {contactInfo && contactInfo.filter((c) => c.status !== "archived").length > 0 && (
            <div style={{ marginTop: 6, paddingTop: 14, borderTop: "1px solid rgba(239,235,182,0.15)" }}>
              <h5 className="kw-heading" style={{ margin: "0 0 10px", fontSize: "1rem", color: "#EFEBDD" }}>
                ہم سے رابطہ کریں
              </h5>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10 }}>
                {contactInfo
                  .filter((c) => c.status !== "archived")
                  .map((c) => (
                    <a
                      key={c.id}
                      href={c.type === "phone" ? `tel:${c.value}` : `mailto:${c.value}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        background: "rgba(239,235,182,0.08)",
                        border: "1px solid rgba(239,235,182,0.18)",
                        borderRadius: 999,
                        padding: "7px 14px",
                        fontSize: "0.82rem",
                        color: "#EFEBDD",
                        textDecoration: "none",
                        direction: "ltr",
                      }}
                    >
                      {c.type === "phone" ? <Phone size={13} /> : <Mail size={13} />}
                      <span style={{ direction: "ltr" }}>{c.value}</span>
                      {c.label && <span style={{ color: "#B7CFC3", fontSize: "0.72rem" }}>({c.label})</span>}
                    </a>
                  ))}
              </div>
            </div>
          )}

          <p style={{ margin: "6px 0 0", fontSize: "0.78rem", color: "#8FA69B" }}>
            © {new Date().getFullYear()} {siteConfig.orgNameUrdu} — {siteConfig.footer.copyrightLine}
          </p>
        </div>
      </footer>

      {/* Discreet entry point into the Super Admin Panel — no auth yet */}
      <button
        onClick={onOpenAdmin}
        className="kw-admin-fab"
        aria-label="سپر ایڈمن پینل کھولیں"
        style={{
          position: "fixed",
          bottom: 18,
          insetInlineStart: 18,
          zIndex: 40,
          background: theme.primary,
          color: "#FBF9F4",
          border: "none",
          borderRadius: 999,
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: "0.85rem",
          fontFamily: "'Noto Naskh Arabic', serif",
          cursor: "pointer",
          boxShadow: "0 8px 18px rgba(11,79,63,0.3)",
        }}
      >
        <Settings size={16} />
        ایڈمن پینل
      </button>

      <style>{`
        @media (min-width: 768px) {
          .md-hide { display: none !important; }
          .kw-desktop-nav { display: block !important; }
        }
      `}</style>
    </div>
  );
}

/* ============================================================
   SUPER ADMIN PANEL (Phase 1B — Part A)
   ------------------------------------------------------------
   No login, no database. Edits happen in local "draft" state;
   nothing on the live Home Page changes until "تبدیلیاں محفوظ
   کریں" (Save) is pressed, at which point the draft is lifted
   up to <App>'s state via onApply. That is the entirety of what
   "persistence" means in this phase — it resets on page reload,
   exactly as expected before a database is connected.
   ============================================================ */
function AdminPanel({ siteConfig, cardRegistry, fundConfig, onApply, onBack, onLogout, isSuperAdmin, allowedSections, onOpenAdminUsers, onOpenMembers, onOpenFunds, onOpenExpenses, onOpenSummary, onOpenReports, onOpenDastoor, onOpenNotices, onOpenActivities, onOpenAchievements, onOpenContact, onMigrateNow }) {
  const [draftSite, setDraftSite] = useState(siteConfig);
  const [draftCards, setDraftCards] = useState(cardRegistry);
  const [draftFund, setDraftFund] = useState(fundConfig);
  const [savedFlash, setSavedFlash] = useState(false);
  const [migrateStatus, setMigrateStatus] = useState(""); // "" | "running" | "done" | "error"

  async function handleMigrateNow() {
    setMigrateStatus("running");
    try {
      await onMigrateNow();
      setMigrateStatus("done");
    } catch (err) {
      console.error("Migration failed:", err);
      setMigrateStatus("error");
    }
    setTimeout(() => setMigrateStatus(""), 4000);
  }

  function canSee(section) {
    return isSuperAdmin || allowedSections.includes(section);
  }

  const NAV_BUTTONS = [
    { section: "members", icon: Users, label: "ممبران کا انتظام", onClick: onOpenMembers },
    { section: "funds", icon: Wallet, label: "فنڈز کا انتظام", onClick: onOpenFunds },
    { section: "expenses", icon: Receipt, label: "اخراجات کا انتظام", onClick: onOpenExpenses },
    { section: "reports-admin", icon: ClipboardList, label: "رپورٹس", onClick: onOpenReports },
    { section: "summary", icon: FileBarChart, label: "مالی خلاصہ", onClick: onOpenSummary },
    { section: "dastoor-admin", icon: BookOpenText, label: "دستور کا انتظام", onClick: onOpenDastoor },
    { section: "notices-admin", icon: Bell, label: "نوٹسز کا انتظام", onClick: onOpenNotices },
    { section: "activities-admin", icon: Activity, label: "سرگرمیوں کا انتظام", onClick: onOpenActivities },
    { section: "achievements-admin", icon: Award, label: "حوصلہ افزائی کا انتظام", onClick: onOpenAchievements },
    { section: "contact-admin", icon: Phone, label: "رابطہ معلومات", onClick: onOpenContact },
  ];

  const theme = draftSite.theme;
  const sortedCards = [...draftCards].sort((a, b) => a.order - b.order);

  function patchSite(patch) {
    setDraftSite((prev) => ({ ...prev, ...patch }));
  }
  function patchTheme(patch) {
    setDraftSite((prev) => ({ ...prev, theme: { ...prev.theme, ...patch } }));
  }
  function patchFooter(patch) {
    setDraftSite((prev) => ({ ...prev, footer: { ...prev.footer, ...patch } }));
  }
  function patchCard(id, patch) {
    setDraftCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }
  function moveCard(id, direction) {
    setDraftCards((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((c) => c.id === id);
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= sorted.length) return prev;
      const a = sorted[idx];
      const b = sorted[swapIdx];
      return prev.map((c) => {
        if (c.id === a.id) return { ...c, order: b.order };
        if (c.id === b.id) return { ...c, order: a.order };
        return c;
      });
    });
  }

  function handleSave() {
    onApply({ siteConfig: draftSite, cardRegistry: draftCards, fundConfig: draftFund });
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2500);
  }

  const sectionStyle = {
    background: "#FFFFFF",
    border: `1px solid ${theme.border}`,
    borderRadius: 16,
    padding: "16px",
    marginBottom: 16,
    boxShadow: "0 1px 2px rgba(31,42,36,0.06)",
  };
  const labelStyle = { display: "block", fontSize: "0.82rem", color: theme.textMuted, marginBottom: 4 };
  const inputStyle = {
    width: "100%",
    boxSizing: "border-box",
    padding: "9px 10px",
    borderRadius: 9,
    border: `1px solid ${theme.border}`,
    fontFamily: "'Noto Naskh Arabic', serif",
    fontSize: "0.9rem",
    color: theme.textStrong,
    background: "#FDFCF9",
    marginBottom: 12,
  };
  const sectionTitleStyle = {
    fontFamily: "'Noto Nastaliq Urdu', serif",
    fontSize: "1.1rem",
    color: theme.primary,
    margin: "0 0 12px",
    display: "flex",
    alignItems: "center",
    gap: 8,
  };

  return (
    <div
      dir="rtl"
      lang="ur"
      style={{
        minHeight: "100vh",
        background: `linear-gradient(180deg, ${theme.background} 0%, ${theme.backgroundAlt} 100%)`,
        fontFamily: "'Noto Naskh Arabic', serif",
        color: theme.textStrong,
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400..700&family=Noto+Naskh+Arabic:wght@400..700&display=swap');
        input[type="color"] { -webkit-appearance: none; border: none; padding: 0; width: 40px; height: 34px; border-radius: 8px; cursor: pointer; }
        input[type="color"]::-webkit-color-swatch-wrapper { padding: 0; }
        input[type="color"]::-webkit-color-swatch { border-radius: 8px; border: 1px solid ${theme.border}; }
      `}</style>

      {/* Admin header */}
      <header
        style={{
          background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryDark} 100%)`,
          color: "#FBF9F4",
          position: "sticky",
          top: 0,
          zIndex: 20,
          padding: "14px 18px",
        }}
      >
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Settings size={20} />
            <h1 style={{ fontFamily: "'Noto Nastaliq Urdu', serif", fontSize: "1.15rem", margin: 0 }}>سپر ایڈمن پینل</h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {NAV_BUTTONS.filter((b) => canSee(b.section)).map((b) => {
              const Icon = b.icon;
              return (
                <button
                  key={b.section}
                  onClick={b.onClick}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: "rgba(251,249,244,0.14)",
                    border: "1px solid rgba(251,249,244,0.35)",
                    color: "#FBF9F4",
                    borderRadius: 999,
                    padding: "7px 14px",
                    fontSize: "0.85rem",
                    cursor: "pointer",
                    fontFamily: "'Noto Naskh Arabic', serif",
                  }}
                >
                  <Icon size={15} />
                  {b.label}
                </button>
              );
            })}
            {isSuperAdmin && (
              <button
                onClick={onOpenAdminUsers}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "rgba(251,249,244,0.14)",
                  border: "1px solid rgba(251,249,244,0.35)",
                  color: "#FBF9F4",
                  borderRadius: 999,
                  padding: "7px 14px",
                  fontSize: "0.85rem",
                  cursor: "pointer",
                  fontFamily: "'Noto Naskh Arabic', serif",
                }}
              >
                <ShieldCheck size={15} />
                Admin Users
              </button>
            )}
            {isSuperAdmin && (
              <button
                onClick={handleMigrateNow}
                disabled={migrateStatus === "running"}
                title="موجودہ Members اور Payments کو الگ محفوظ Firestore collections میں کاپی کریں (کچھ نہیں حذف ہوگا)"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "rgba(251,249,244,0.14)",
                  border: "1px solid rgba(251,249,244,0.35)",
                  color: "#FBF9F4",
                  borderRadius: 999,
                  padding: "7px 14px",
                  fontSize: "0.85rem",
                  cursor: migrateStatus === "running" ? "default" : "pointer",
                  fontFamily: "'Noto Naskh Arabic', serif",
                  opacity: migrateStatus === "running" ? 0.7 : 1,
                }}
              >
                <ShieldCheck size={15} />
                {migrateStatus === "running" ? "کاپی ہو رہا ہے..." : migrateStatus === "done" ? "✓ محفوظ کاپی ہو گئی" : migrateStatus === "error" ? "مسئلہ ہوا، دوبارہ کوشش کریں" : "Secure Collections کاپی کریں"}
              </button>
            )}
            <button
              onClick={onBack}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "rgba(251,249,244,0.14)",
                border: "1px solid rgba(251,249,244,0.35)",
                color: "#FBF9F4",
                borderRadius: 999,
                padding: "7px 14px",
                fontSize: "0.85rem",
                cursor: "pointer",
                fontFamily: "'Noto Naskh Arabic', serif",
              }}
            >
              <ArrowRight size={15} />
              ویب سائٹ دیکھیں
            </button>
            <button
              onClick={onLogout}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "rgba(178,52,52,0.18)",
                border: "1px solid rgba(251,249,244,0.35)",
                color: "#FBF9F4",
                borderRadius: 999,
                padding: "7px 14px",
                fontSize: "0.85rem",
                cursor: "pointer",
                fontFamily: "'Noto Naskh Arabic', serif",
              }}
            >
              <LogOut size={15} />
              لاگ آؤٹ
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 900, margin: "0 auto", padding: "20px 16px 120px" }}>
        {!isSuperAdmin && !canSee("settings") && (
          <section style={{ ...sectionStyle, background: "rgba(184,134,43,0.08)", border: `1px solid ${theme.accent}` }}>
            <p style={{ margin: 0, fontSize: "0.85rem", color: theme.textStrong }}>
              آپ کو محدود رسائی (Limited Admin) دی گئی ہے۔ اوپر صرف وہی حصے نظر آتے ہیں جن کی اجازت آپ کو Super Admin نے دی ہے۔
            </p>
          </section>
        )}
        {canSee("settings") && (
        <>
        {/* 1. Organization Branding */}
        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>تنظیم کی برانڈنگ</h2>
          <label style={labelStyle}>اردو تنظیم کا نام</label>
          <input style={inputStyle} value={draftSite.orgNameUrdu} onChange={(e) => patchSite({ orgNameUrdu: e.target.value })} />
          <label style={labelStyle}>English Organization Name</label>
          <input style={{ ...inputStyle, fontFamily: "inherit", direction: "ltr", textAlign: "left" }} value={draftSite.orgNameEnglish} onChange={(e) => patchSite({ orgNameEnglish: e.target.value })} />
          <label style={labelStyle}>Short Name</label>
          <input style={{ ...inputStyle, direction: "ltr", textAlign: "left", maxWidth: 140 }} value={draftSite.shortName} onChange={(e) => patchSite({ shortName: e.target.value.slice(0, 6) })} />
          <label style={labelStyle}>Logo / Monogram (پہلے سے Short Name سے خودکار بنتا ہے)</label>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div
              aria-hidden="true"
              style={{
                width: 44, height: 44, borderRadius: 12,
                background: `linear-gradient(155deg, ${theme.accent} 0%, #9C6E1F 100%)`,
                color: theme.primaryDark, display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: 15, border: "1px solid rgba(0,0,0,0.08)",
              }}
            >
              {draftSite.shortName}
            </div>
            <span style={{ fontSize: "0.78rem", color: theme.textMuted }}>
              فائل اپلوڈ کے ذریعے Logo image لگانا اسٹوریج/ڈیٹابیس کے ساتھ Phase 1B کے اگلے حصے میں شامل ہوگا۔
            </span>
          </div>
        </section>

        {/* 2. Theme */}
        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>تھیم کے رنگ</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
            <ColorField label="Primary" value={theme.primary} onChange={(v) => patchTheme({ primary: v })} />
            <ColorField label="Primary Dark" value={theme.primaryDark} onChange={(v) => patchTheme({ primaryDark: v })} />
            <ColorField label="Accent" value={theme.accent} onChange={(v) => patchTheme({ accent: v })} />
            <ColorField label="Background" value={theme.background} onChange={(v) => patchTheme({ background: v })} />
          </div>
        </section>

        {/* 3. Home Page Headings */}
        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>ہوم پیج کی Headings</h2>
          <label style={labelStyle}>Main Heading</label>
          <input style={inputStyle} value={draftSite.homeHeading} onChange={(e) => patchSite({ homeHeading: e.target.value })} />
          <label style={labelStyle}>Subheading</label>
          <textarea
            style={{ ...inputStyle, minHeight: 64, resize: "vertical", marginBottom: 0 }}
            value={draftSite.homeSubheading}
            onChange={(e) => patchSite({ homeSubheading: e.target.value })}
          />
        </section>

        {/* 4. Cards Management */}
        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>کارڈز کا انتظام</h2>
          <p style={{ fontSize: "0.78rem", color: theme.textMuted, margin: "0 0 12px" }}>
            ترتیب ہمیشہ نیچے دی گئی فہرست کے مطابق Home Page پر ظاہر ہوگی۔ اوپر/نیچے تیر سے ترتیب بدلیں۔
          </p>
          <div style={{ display: "grid", gap: 10 }}>
            {sortedCards.map((card, idx) => {
              const Icon = ICON_MAP[card.icon] || Info;
              return (
                <div key={card.id} style={{ border: `1px solid ${theme.border}`, borderRadius: 12, padding: 12, background: "#FDFCF9" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <button
                        aria-label="اوپر منتقل کریں"
                        disabled={idx === 0}
                        onClick={() => moveCard(card.id, "up")}
                        style={{ ...iconBtnStyle(theme), opacity: idx === 0 ? 0.35 : 1 }}
                      >
                        <ChevronUp size={15} />
                      </button>
                      <button
                        aria-label="نیچے منتقل کریں"
                        disabled={idx === sortedCards.length - 1}
                        onClick={() => moveCard(card.id, "down")}
                        style={{ ...iconBtnStyle(theme), opacity: idx === sortedCards.length - 1 ? 0.35 : 1 }}
                      >
                        <ChevronDown size={15} />
                      </button>
                    </div>

                    <div style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(11,79,63,0.08)", display: "flex", alignItems: "center", justifyContent: "center", color: theme.primary, flexShrink: 0 }}>
                      <Icon size={17} strokeWidth={1.9} />
                    </div>

                    <span style={{ fontSize: "0.72rem", color: theme.textMuted, flexShrink: 0 }}>ترتیب: {idx + 1}</span>

                    <div style={{ flex: 1 }} />

                    <button
                      onClick={() => patchCard(card.id, { visible: !card.visible })}
                      style={{
                        display: "flex", alignItems: "center", gap: 5,
                        background: card.visible ? "rgba(11,79,63,0.08)" : "rgba(184,134,43,0.12)",
                        color: card.visible ? theme.primary : theme.accent,
                        border: "none", borderRadius: 999, padding: "5px 10px", fontSize: "0.74rem", cursor: "pointer",
                      }}
                    >
                      {card.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                      {card.visible ? "نظر آ رہا ہے" : "چھپا ہوا"}
                    </button>
                  </div>

                  <label style={{ ...labelStyle, marginBottom: 3 }}>Home Page Card Heading (عنوان)</label>
                  <input style={{ ...inputStyle, marginBottom: 8 }} value={card.title} onChange={(e) => patchCard(card.id, { title: e.target.value })} />

                  <label style={{ ...labelStyle, marginBottom: 3 }}>مختصر تفصیل (Card Text)</label>
                  <input style={{ ...inputStyle, marginBottom: 0 }} value={card.text} onChange={(e) => patchCard(card.id, { text: e.target.value })} />
                </div>
              );
            })}
          </div>
        </section>

        {/* 5. Monthly Fund Amount */}
        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>ماہانہ فنڈ</h2>
          <label style={labelStyle}>مقررہ ماہانہ فنڈ (Monthly Fund Amount)</label>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="number"
              min="0"
              style={{ ...inputStyle, marginBottom: 0, maxWidth: 160 }}
              value={draftFund.monthlyFundAmount}
              onChange={(e) => setDraftFund((prev) => ({ ...prev, monthlyFundAmount: Number(e.target.value) || 0 }))}
            />
            <span style={{ color: theme.textMuted, fontSize: "0.9rem" }}>{draftFund.currency}</span>
          </div>
          <p style={{ fontSize: "0.78rem", color: theme.textMuted, marginTop: 8, marginBottom: 0 }}>
            یہ قدر Home Page پر "فنڈز" Card میں خودکار طور پر ظاہر ہوگی۔
          </p>
        </section>
        </>
        )}
      </main>

      {/* Sticky Save bar — only relevant when the settings sections above are visible */}
      {canSee("settings") && (
      <div
        style={{
          position: "fixed",
          bottom: 0,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          background: "#FFFFFF",
          borderTop: `1px solid ${theme.border}`,
          padding: "12px 16px",
          display: "flex",
          justifyContent: "center",
          gap: 12,
          boxShadow: "0 -6px 16px rgba(31,42,36,0.08)",
          zIndex: 25,
        }}
      >
        {savedFlash && (
          <span style={{ display: "flex", alignItems: "center", gap: 6, color: theme.primary, fontSize: "0.85rem", alignSelf: "center" }}>
            <CheckCircle2 size={16} /> تبدیلیاں کامیابی سے لاگو ہوگئیں
          </span>
        )}
        <button
          onClick={handleSave}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryDark} 100%)`,
            color: "#FBF9F4", border: "none", borderRadius: 12, padding: "12px 28px",
            fontSize: "0.95rem", fontFamily: "'Noto Naskh Arabic', serif", cursor: "pointer",
            boxShadow: "0 6px 16px rgba(11,79,63,0.28)",
          }}
        >
          <Save size={17} />
          تبدیلیاں محفوظ کریں
        </button>
      </div>
      )}
    </div>
  );
}

function ColorField({ label, value, onChange }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: "0.78rem", color: "#5B6B62", marginBottom: 4 }}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
        <span style={{ fontSize: "0.78rem", direction: "ltr", color: "#5B6B62" }}>{value}</span>
      </div>
    </div>
  );
}

function iconBtnStyle(theme) {
  return {
    width: 24,
    height: 20,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: `1px solid ${theme.border}`,
    borderRadius: 5,
    background: "#FFFFFF",
    color: theme.primary,
    cursor: "pointer",
    padding: 0,
  };
}

/* ============================================================
   MEMBERS MANAGEMENT (Phase 1B — Members part)
   ------------------------------------------------------------
   No database yet — same draft-then-Save pattern as AdminPanel.
   Members are never permanently deleted, only moved between
   'active' / 'inactive' / 'archived' so financial history tied
   to a member (in a future phase) is never lost.
   ============================================================ */
const STATUS_LABELS_UR = { active: "فعال", inactive: "غیر فعال", archived: "آرکائیو شدہ" };

function emptyMemberForm() {
  return { memberId: "", name: "", contactNumber: "", joiningDate: "", photo: "", notes: "" };
}

function MembersManagement({ theme, members, onApply, onBack }) {
  const [draftMembers, setDraftMembers] = useState(members);
  const [savedFlash, setSavedFlash] = useState(false);
  const [filter, setFilter] = useState("all"); // all | active | inactive | archived
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState(emptyMemberForm());
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(emptyMemberForm());
  const [linkingId, setLinkingId] = useState(null);
  const [linkForm, setLinkForm] = useState({ email: "", password: "" });
  const [linkError, setLinkError] = useState("");
  const [linkBusy, setLinkBusy] = useState(false);

  const stats = {
    total: draftMembers.length,
    active: draftMembers.filter((m) => m.status === "active").length,
    inactive: draftMembers.filter((m) => m.status === "inactive").length,
    archived: draftMembers.filter((m) => m.status === "archived").length,
  };

  const visibleMembers = filter === "all" ? draftMembers : draftMembers.filter((m) => m.status === filter);

  function handleSave() {
    onApply(draftMembers);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2500);
  }

  function setStatus(id, status) {
    setDraftMembers((prev) => prev.map((m) => (m.id === id ? { ...m, status } : m)));
  }

  /* ---- Member login account creation ----
     Creates a real Firebase Auth account (email+password fully owned and
     stored by Firebase Auth itself — never touches Firestore) via a
     temporary secondary Firebase App instance, so the currently signed-in
     Admin's own session is never disturbed. On success, only the returned
     UID is saved onto the member record (authUid) — this is the link that
     a (future) secure per-member Firestore rule would check against
     request.auth.uid. This screen does NOT yet grant that member any
     private Fund view — see the accompanying report for why that piece
     needs a separate, carefully tested database restructuring step. */
  function startLinkAccount(memberId) {
    setLinkingId(memberId);
    setLinkForm({ email: "", password: "" });
    setLinkError("");
  }

  async function submitLinkAccount(memberId) {
    setLinkError("");
    if (!linkForm.email.trim() || !linkForm.password) {
      setLinkError("Email اور Password دونوں درج کریں۔");
      return;
    }
    if (linkForm.password.length < 6) {
      setLinkError("Password کم از کم 6 حروف کا ہونا چاہیے (Firebase کی شرط)۔");
      return;
    }
    setLinkBusy(true);
    try {
      const uid = await createMemberAuthAccount(linkForm.email.trim(), linkForm.password);
      setDraftMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, authUid: uid } : m)));
      setLinkingId(null);
      setLinkForm({ email: "", password: "" });
    } catch (err) {
      console.error("Member account creation failed:", err);
      if (err && err.code === "auth/email-already-in-use") {
        setLinkError("یہ Email پہلے سے کسی اور اکاؤنٹ کے لیے استعمال ہو چکی ہے۔");
      } else {
        setLinkError("اکاؤنٹ بنانے میں مسئلہ ہوا۔ دوبارہ کوشش کریں۔");
      }
    }
    setLinkBusy(false);
  }

  function unlinkAccount(memberId) {
    if (!window.confirm("کیا آپ واقعی اس رکن کا لاگ اِن اکاؤنٹ اس ریکارڈ سے ہٹانا چاہتے ہیں؟ (Firebase اکاؤنٹ خود حذف نہیں ہوگا، صرف اس رکن سے اس کا تعلق ختم ہوگا۔)")) return;
    setDraftMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, authUid: null } : m)));
  }

  function addMember() {
    if (!addForm.name.trim()) return;
    const nextIndex = draftMembers.length + 1;
    const newMember = {
      id: `member-${Date.now()}`,
      memberId: addForm.memberId.trim() || `M-${String(nextIndex).padStart(3, "0")}`,
      name: addForm.name.trim(),
      contactNumber: addForm.contactNumber.trim(),
      joiningDate: addForm.joiningDate,
      photo: addForm.photo.trim(),
      notes: addForm.notes.trim(),
      status: "active",
      authUid: null,
    };
    setDraftMembers((prev) => [...prev, newMember]);
    setAddForm(emptyMemberForm());
    setShowAddForm(false);
  }

  function startEdit(member) {
    setEditingId(member.id);
    setEditForm({
      memberId: member.memberId,
      name: member.name,
      contactNumber: member.contactNumber,
      joiningDate: member.joiningDate,
      photo: member.photo,
      notes: member.notes,
    });
  }

  function saveEdit(id) {
    setDraftMembers((prev) =>
      prev.map((m) =>
        m.id === id
          ? {
              ...m,
              memberId: editForm.memberId.trim() || m.memberId,
              name: editForm.name.trim() || m.name,
              contactNumber: editForm.contactNumber.trim(),
              joiningDate: editForm.joiningDate,
              photo: editForm.photo.trim(),
              notes: editForm.notes.trim(),
            }
          : m
      )
    );
    setEditingId(null);
  }

  const sectionStyle = {
    background: "#FFFFFF",
    border: `1px solid ${theme.border}`,
    borderRadius: 16,
    padding: "16px",
    marginBottom: 16,
    boxShadow: "0 1px 2px rgba(31,42,36,0.06)",
  };
  const labelStyle = { display: "block", fontSize: "0.78rem", color: theme.textMuted, marginBottom: 4 };
  const inputStyle = {
    width: "100%",
    boxSizing: "border-box",
    padding: "9px 10px",
    borderRadius: 9,
    border: `1px solid ${theme.border}`,
    fontFamily: "'Noto Naskh Arabic', serif",
    fontSize: "0.9rem",
    color: theme.textStrong,
    background: "#FDFCF9",
    marginBottom: 10,
  };

  function MemberFormFields({ form, setForm }) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
        <div>
          <label style={labelStyle}>نام (Name)</label>
          <input style={{ ...inputStyle, marginBottom: 0 }} value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
        </div>
        <div>
          <label style={labelStyle}>Member ID</label>
          <input style={{ ...inputStyle, marginBottom: 0, direction: "ltr", textAlign: "left" }} value={form.memberId} onChange={(e) => setForm((p) => ({ ...p, memberId: e.target.value }))} />
        </div>
        <div>
          <label style={labelStyle}>رابطہ نمبر (Contact Number)</label>
          <input style={{ ...inputStyle, marginBottom: 0, direction: "ltr", textAlign: "left" }} value={form.contactNumber} onChange={(e) => setForm((p) => ({ ...p, contactNumber: e.target.value }))} />
        </div>
        <div>
          <label style={labelStyle}>تاریخ شمولیت (Joining Date)</label>
          <input type="date" style={{ ...inputStyle, marginBottom: 0, direction: "ltr" }} value={form.joiningDate} onChange={(e) => setForm((p) => ({ ...p, joiningDate: e.target.value }))} />
        </div>
        <div>
          <label style={labelStyle}>تصویر URL (Photo)</label>
          <input style={{ ...inputStyle, marginBottom: 0, direction: "ltr", textAlign: "left" }} placeholder="https://..." value={form.photo} onChange={(e) => setForm((p) => ({ ...p, photo: e.target.value }))} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>مختصر نوٹس (Notes)</label>
          <input style={{ ...inputStyle, marginBottom: 0 }} value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
        </div>
      </div>
    );
  }

  function statusBadgeStyle(status) {
    const map = {
      active: { bg: "rgba(11,79,63,0.1)", color: theme.primary },
      inactive: { bg: "rgba(184,134,43,0.14)", color: theme.accent },
      archived: { bg: "rgba(91,107,98,0.14)", color: theme.textMuted },
    };
    const c = map[status] || map.inactive;
    return { background: c.bg, color: c.color, borderRadius: 999, padding: "3px 10px", fontSize: "0.72rem", flexShrink: 0 };
  }

  return (
    <div dir="rtl" lang="ur" style={{ minHeight: "100vh", background: `linear-gradient(180deg, ${theme.background} 0%, ${theme.backgroundAlt} 100%)`, fontFamily: "'Noto Naskh Arabic', serif", color: theme.textStrong }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400..700&family=Noto+Naskh+Arabic:wght@400..700&display=swap');`}</style>

      <header style={{ background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryDark} 100%)`, color: "#FBF9F4", position: "sticky", top: 0, zIndex: 20, padding: "14px 18px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Users size={20} />
            <h1 style={{ fontFamily: "'Noto Nastaliq Urdu', serif", fontSize: "1.15rem", margin: 0 }}>ممبران کا انتظام</h1>
          </div>
          <button
            onClick={onBack}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(251,249,244,0.14)", border: "1px solid rgba(251,249,244,0.35)", color: "#FBF9F4", borderRadius: 999, padding: "7px 14px", fontSize: "0.85rem", cursor: "pointer", fontFamily: "'Noto Naskh Arabic', serif" }}
          >
            <ArrowRight size={15} />
            ایڈمن پینل
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 900, margin: "0 auto", padding: "20px 16px 120px" }}>
        {/* Stats */}
        <section style={sectionStyle}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {[
              { label: "کل ممبران", value: stats.total },
              { label: "فعال", value: stats.active },
              { label: "غیر فعال", value: stats.inactive },
              { label: "آرکائیو شدہ", value: stats.archived },
            ].map((s) => (
              <div key={s.label} style={{ flex: "1 1 120px", border: `1px solid ${theme.border}`, borderRadius: 12, padding: "10px 12px", textAlign: "center", background: "#FDFCF9" }}>
                <div style={{ fontSize: "1.2rem", fontWeight: 700, color: theme.primary }}>{s.value}</div>
                <div style={{ fontSize: "0.75rem", color: theme.textMuted }}>{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Filter + Add */}
        <section style={sectionStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: showAddForm ? 14 : 0 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[
                ["all", "سب"],
                ["active", "فعال"],
                ["inactive", "غیر فعال"],
                ["archived", "آرکائیو"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  style={{
                    border: `1px solid ${theme.border}`,
                    borderRadius: 999,
                    padding: "6px 12px",
                    fontSize: "0.78rem",
                    cursor: "pointer",
                    background: filter === key ? theme.primary : "#FDFCF9",
                    color: filter === key ? "#FBF9F4" : theme.textStrong,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowAddForm((v) => !v)}
              style={{ display: "flex", alignItems: "center", gap: 6, background: theme.primary, color: "#FBF9F4", border: "none", borderRadius: 999, padding: "8px 16px", fontSize: "0.82rem", cursor: "pointer" }}
            >
              {showAddForm ? "بند کریں" : "+ نیا ممبر شامل کریں"}
            </button>
          </div>

          {showAddForm && (
            <div style={{ borderTop: `1px dashed ${theme.border}`, paddingTop: 14 }}>
              {MemberFormFields({ form: addForm, setForm: setAddForm })}
              <button
                onClick={addMember}
                disabled={!addForm.name.trim()}
                style={{ marginTop: 10, background: theme.primary, color: "#FBF9F4", border: "none", borderRadius: 10, padding: "9px 18px", fontSize: "0.85rem", cursor: "pointer", opacity: addForm.name.trim() ? 1 : 0.5 }}
              >
                شامل کریں
              </button>
            </div>
          )}
        </section>

        {/* Members list */}
        <section style={sectionStyle}>
          <div style={{ display: "grid", gap: 10 }}>
            {visibleMembers.length === 0 && (
              <p style={{ fontSize: "0.85rem", color: theme.textMuted, textAlign: "center", margin: 0 }}>اس فہرست میں کوئی ممبر موجود نہیں۔</p>
            )}
            {visibleMembers.map((member) => (
              <div key={member.id} style={{ border: `1px solid ${theme.border}`, borderRadius: 12, padding: 12, background: "#FDFCF9" }}>
                {editingId === member.id ? (
                  <div>
                    {MemberFormFields({ form: editForm, setForm: setEditForm })}
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <button onClick={() => saveEdit(member.id)} style={{ background: theme.primary, color: "#FBF9F4", border: "none", borderRadius: 9, padding: "7px 14px", fontSize: "0.8rem", cursor: "pointer" }}>
                        محفوظ کریں
                      </button>
                      <button onClick={() => setEditingId(null)} style={{ background: "#fff", border: `1px solid ${theme.border}`, color: theme.textMuted, borderRadius: 9, padding: "7px 14px", fontSize: "0.8rem", cursor: "pointer" }}>
                        منسوخ
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <div
                      style={{
                        width: 42, height: 42, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
                        background: "rgba(11,79,63,0.08)", display: "flex", alignItems: "center", justifyContent: "center",
                        color: theme.primary, fontWeight: 700, fontSize: "0.9rem",
                      }}
                    >
                      {member.photo ? (
                        <img src={member.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        member.name.trim().charAt(0) || "؟"
                      )}
                    </div>

                    <div style={{ flex: "1 1 160px", minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700 }}>{member.name}</span>
                        <span style={statusBadgeStyle(member.status)}>{STATUS_LABELS_UR[member.status]}</span>
                      </div>
                      <div style={{ fontSize: "0.75rem", color: theme.textMuted, marginTop: 2 }}>
                        {member.memberId}
                        {member.contactNumber ? ` · ${member.contactNumber}` : ""}
                        {member.joiningDate ? ` · شمولیت: ${member.joiningDate}` : ""}
                      </div>
                      {member.notes && <div style={{ fontSize: "0.72rem", color: theme.textMuted, marginTop: 2 }}>{member.notes}</div>}
                    </div>

                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button onClick={() => startEdit(member)} style={{ border: `1px solid ${theme.border}`, background: "#fff", color: theme.primary, borderRadius: 999, padding: "5px 11px", fontSize: "0.72rem", cursor: "pointer" }}>
                        ترمیم
                      </button>
                      {member.status !== "active" && (
                        <button onClick={() => setStatus(member.id, "active")} style={{ border: "none", background: "rgba(11,79,63,0.1)", color: theme.primary, borderRadius: 999, padding: "5px 11px", fontSize: "0.72rem", cursor: "pointer" }}>
                          بحال کریں
                        </button>
                      )}
                      {member.status === "active" && (
                        <button onClick={() => setStatus(member.id, "inactive")} style={{ border: "none", background: "rgba(184,134,43,0.14)", color: theme.accent, borderRadius: 999, padding: "5px 11px", fontSize: "0.72rem", cursor: "pointer" }}>
                          غیر فعال کریں
                        </button>
                      )}
                      {member.status !== "archived" && (
                        <button onClick={() => setStatus(member.id, "archived")} style={{ border: "none", background: "rgba(91,107,98,0.14)", color: theme.textMuted, borderRadius: 999, padding: "5px 11px", fontSize: "0.72rem", cursor: "pointer" }}>
                          آرکائیو کریں
                        </button>
                      )}
                      {member.authUid ? (
                        <button onClick={() => unlinkAccount(member.id)} style={{ border: "none", background: "rgba(11,79,63,0.1)", color: theme.primary, borderRadius: 999, padding: "5px 11px", fontSize: "0.72rem", cursor: "pointer" }}>
                          ✓ اکاؤنٹ موجود ہے
                        </button>
                      ) : (
                        <button onClick={() => startLinkAccount(member.id)} style={{ border: `1px solid ${theme.border}`, background: "#fff", color: theme.textMuted, borderRadius: 999, padding: "5px 11px", fontSize: "0.72rem", cursor: "pointer" }}>
                          Login Account بنائیں
                        </button>
                      )}
                    </div>

                    {linkingId === member.id && (
                      <div style={{ width: "100%", marginTop: 10, borderTop: `1px dashed ${theme.border}`, paddingTop: 10 }}>
                        <p style={{ fontSize: "0.75rem", color: theme.textMuted, margin: "0 0 8px" }}>
                          اس رکن کے لیے نیا لاگ اِن اکاؤنٹ — Email اور Password دیں (کم از کم 6 حروف)۔
                        </p>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <input
                            type="email"
                            placeholder="Email"
                            value={linkForm.email}
                            onChange={(e) => setLinkForm((p) => ({ ...p, email: e.target.value }))}
                            style={{ flex: "1 1 160px", boxSizing: "border-box", padding: "8px 10px", borderRadius: 9, border: `1px solid ${theme.border}`, fontSize: "0.85rem", direction: "ltr", textAlign: "left" }}
                          />
                          <input
                            type="password"
                            placeholder="Password"
                            value={linkForm.password}
                            onChange={(e) => setLinkForm((p) => ({ ...p, password: e.target.value }))}
                            style={{ flex: "1 1 140px", boxSizing: "border-box", padding: "8px 10px", borderRadius: 9, border: `1px solid ${theme.border}`, fontSize: "0.85rem", direction: "ltr", textAlign: "left" }}
                          />
                        </div>
                        {linkError && <p style={{ fontSize: "0.75rem", color: "#B23434", margin: "8px 0 0" }}>{linkError}</p>}
                        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                          <button
                            onClick={() => submitLinkAccount(member.id)}
                            disabled={linkBusy}
                            style={{ background: theme.primary, color: "#FBF9F4", border: "none", borderRadius: 9, padding: "7px 14px", fontSize: "0.78rem", cursor: linkBusy ? "default" : "pointer", opacity: linkBusy ? 0.7 : 1 }}
                          >
                            {linkBusy ? "بن رہا ہے..." : "اکاؤنٹ بنائیں"}
                          </button>
                          <button onClick={() => setLinkingId(null)} style={{ background: "#fff", border: `1px solid ${theme.border}`, color: theme.textMuted, borderRadius: 9, padding: "7px 14px", fontSize: "0.78rem", cursor: "pointer" }}>
                            منسوخ
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>

      <div style={{ position: "fixed", bottom: 0, insetInlineStart: 0, insetInlineEnd: 0, background: "#FFFFFF", borderTop: `1px solid ${theme.border}`, padding: "12px 16px", display: "flex", justifyContent: "center", gap: 12, boxShadow: "0 -6px 16px rgba(31,42,36,0.08)", zIndex: 25 }}>
        {savedFlash && (
          <span style={{ display: "flex", alignItems: "center", gap: 6, color: theme.primary, fontSize: "0.85rem", alignSelf: "center" }}>
            <CheckCircle2 size={16} /> تبدیلیاں کامیابی سے محفوظ ہوگئیں
          </span>
        )}
        <button
          onClick={handleSave}
          style={{ display: "flex", alignItems: "center", gap: 8, background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryDark} 100%)`, color: "#FBF9F4", border: "none", borderRadius: 12, padding: "12px 28px", fontSize: "0.95rem", fontFamily: "'Noto Naskh Arabic', serif", cursor: "pointer", boxShadow: "0 6px 16px rgba(11,79,63,0.28)" }}
        >
          <Save size={17} />
          تبدیلیاں محفوظ کریں
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   GENERIC CARD PAGE (Phase 1B — Card Pages / Routing)
   ------------------------------------------------------------
   Every visible Home Page card now navigates here instead of
   scrolling to itself. This is a shared placeholder screen — no
   card-specific financial/member logic is built yet, exactly as
   scoped. Each card's own dedicated page/content is a later,
   separate step; this only proves out the navigation.
   ============================================================ */
function CardPage({ theme, card, onBack }) {
  const Icon = ICON_MAP[card.icon] || Info;
  return (
    <div
      dir="rtl"
      lang="ur"
      style={{
        minHeight: "100vh",
        background: `linear-gradient(180deg, ${theme.background} 0%, ${theme.backgroundAlt} 100%)`,
        fontFamily: "'Noto Naskh Arabic', serif",
        color: theme.textStrong,
      }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400..700&family=Noto+Naskh+Arabic:wght@400..700&display=swap');`}</style>

      <header
        style={{
          background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryDark} 100%)`,
          color: "#FBF9F4",
          position: "sticky",
          top: 0,
          zIndex: 20,
          padding: "14px 18px",
        }}
      >
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Icon size={20} />
            <h1 className="kw-heading" style={{ fontFamily: "'Noto Nastaliq Urdu', serif", fontSize: "1.15rem", margin: 0 }}>
              {card.title}
            </h1>
          </div>
          <button
            onClick={onBack}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(251,249,244,0.14)",
              border: "1px solid rgba(251,249,244,0.35)",
              color: "#FBF9F4",
              borderRadius: 999,
              padding: "7px 14px",
              fontSize: "0.85rem",
              cursor: "pointer",
              fontFamily: "'Noto Naskh Arabic', serif",
            }}
          >
            <ArrowRight size={15} />
            ہوم پیج پر واپس جائیں
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 700, margin: "0 auto", padding: "40px 18px 60px", textAlign: "center" }}>
        <div
          aria-hidden="true"
          style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            background: "rgba(11,79,63,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: theme.primary,
            margin: "0 auto 18px",
          }}
        >
          <Icon size={30} strokeWidth={1.8} />
        </div>
        <h2 className="kw-heading" style={{ fontSize: "1.5rem", color: theme.primary, margin: "0 0 10px" }}>
          {card.title}
        </h2>
        <p style={{ color: theme.textMuted, fontSize: "0.95rem", lineHeight: 2, maxWidth: 480, margin: "0 auto 22px" }}>
          {card.text}
        </p>
        <div
          style={{
            border: `1px dashed ${theme.border}`,
            borderRadius: 14,
            padding: "16px",
            background: "#FDFCF9",
            fontSize: "0.82rem",
            color: theme.textMuted,
          }}
        >
          اس سیکشن کا مکمل مواد اگلے مراحل میں شامل کیا جائے گا۔
        </div>
      </main>
    </div>
  );
}

/* ============================================================
   FUNDS MANAGEMENT (Phase 1B — Funds + Donations + Arrears)
   ------------------------------------------------------------
   Same no-database, draft-then-Save pattern as the other admin
   screens. Every payment recorded here snapshots the required
   fund amount at that moment, runs it through
   computeFundBreakdown(), and is stored against the member's
   stable internal id — so a member's financial history stays
   intact even after they become inactive/archived.
   ============================================================ */
function emptyPaymentForm(fundConfig) {
  const now = new Date();
  return {
    memberId: "",
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    paidAmount: String(fundConfig.monthlyFundAmount),
    paymentDate: now.toISOString().slice(0, 10),
    notes: "",
  };
}

function FundsManagement({ theme, members, fundConfig, payments, deletionLog, onApply, onBack }) {
  const [draftPayments, setDraftPayments] = useState(payments);
  const [draftDeletionLog, setDraftDeletionLog] = useState(deletionLog);
  const [savedFlash, setSavedFlash] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState(emptyPaymentForm(fundConfig));
  const [memberFilter, setMemberFilter] = useState("all");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);

  const sortedMembers = [...members].sort((a, b) => a.name.localeCompare(b.name, "ur"));

  const filteredPayments =
    memberFilter === "all" ? draftPayments : draftPayments.filter((p) => p.memberId === memberFilter);

  const totals = filteredPayments.reduce(
    (acc, p) => {
      acc.fund += p.paidFund;
      acc.donation += p.donation;
      acc.arrears += p.arrears;
      return acc;
    },
    { fund: 0, donation: 0, arrears: 0 }
  );

  function memberLabel(memberId) {
    const m = members.find((mm) => mm.id === memberId);
    return m ? `${m.name} (${m.memberId})` : "نامعلوم رکن";
  }

  function handleSave() {
    onApply(draftPayments, draftDeletionLog);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2500);
  }

  function addPayment() {
    if (!form.memberId) return;
    const requiredFund = fundConfig.monthlyFundAmount;
    const breakdown = computeFundBreakdown(form.paidAmount, requiredFund);
    const record = {
      id: `payment-${Date.now()}`,
      memberId: form.memberId,
      month: Number(form.month),
      year: Number(form.year),
      requiredFund,
      paidAmount: Number(form.paidAmount) || 0,
      paidFund: breakdown.paidFund,
      donation: breakdown.donation,
      arrears: breakdown.arrears,
      paymentDate: form.paymentDate,
      notes: form.notes.trim(),
    };
    setDraftPayments((prev) => [record, ...prev]);
    setForm(emptyPaymentForm(fundConfig));
    setShowAddForm(false);
  }

  function startEdit(p) {
    setEditingId(p.id);
    setEditForm({
      memberId: p.memberId,
      month: p.month,
      year: p.year,
      paidAmount: String(p.paidAmount),
      paymentDate: p.paymentDate,
      notes: p.notes,
    });
  }

  function saveEdit(id) {
    setDraftPayments((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        // The required-fund SNAPSHOT for this historical entry is kept as-is
        // (not re-pulled from current fundConfig) — editing the paid amount
        // re-runs the SAME computeFundBreakdown() engine against that
        // original snapshot, it never invents a new calculation.
        const breakdown = computeFundBreakdown(editForm.paidAmount, p.requiredFund);
        return {
          ...p,
          memberId: editForm.memberId || p.memberId,
          month: Number(editForm.month),
          year: Number(editForm.year),
          paidAmount: Number(editForm.paidAmount) || 0,
          paidFund: breakdown.paidFund,
          donation: breakdown.donation,
          arrears: breakdown.arrears,
          paymentDate: editForm.paymentDate,
          notes: editForm.notes.trim(),
        };
      })
    );
    setEditingId(null);
    setEditForm(null);
  }

  function deletePayment(p) {
    if (!window.confirm("کیا آپ واقعی یہ Fund entry مستقل طور پر حذف کرنا چاہتے ہیں؟")) return;
    setDraftPayments((prev) => prev.filter((x) => x.id !== p.id));
    setDraftDeletionLog((prev) => [
      {
        id: `deletion-${Date.now()}`,
        paymentId: p.id,
        memberId: p.memberId,
        amount: p.paidAmount,
        deletedAt: new Date().toISOString(),
      },
      ...prev,
    ]);
    if (editingId === p.id) {
      setEditingId(null);
      setEditForm(null);
    }
  }

  const sectionStyle = {
    background: "#FFFFFF",
    border: `1px solid ${theme.border}`,
    borderRadius: 16,
    padding: "16px",
    marginBottom: 16,
    boxShadow: "0 1px 2px rgba(31,42,36,0.06)",
  };
  const labelStyle = { display: "block", fontSize: "0.78rem", color: theme.textMuted, marginBottom: 4 };
  const inputStyle = {
    width: "100%",
    boxSizing: "border-box",
    padding: "9px 10px",
    borderRadius: 9,
    border: `1px solid ${theme.border}`,
    fontFamily: "'Noto Naskh Arabic', serif",
    fontSize: "0.9rem",
    color: theme.textStrong,
    background: "#FDFCF9",
    marginBottom: 0,
  };

  const liveBreakdown = computeFundBreakdown(form.paidAmount, fundConfig.monthlyFundAmount);

  return (
    <div dir="rtl" lang="ur" style={{ minHeight: "100vh", background: `linear-gradient(180deg, ${theme.background} 0%, ${theme.backgroundAlt} 100%)`, fontFamily: "'Noto Naskh Arabic', serif", color: theme.textStrong }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400..700&family=Noto+Naskh+Arabic:wght@400..700&display=swap');`}</style>

      <header style={{ background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryDark} 100%)`, color: "#FBF9F4", position: "sticky", top: 0, zIndex: 20, padding: "14px 18px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Wallet size={20} />
            <h1 style={{ fontFamily: "'Noto Nastaliq Urdu', serif", fontSize: "1.15rem", margin: 0 }}>فنڈز کا انتظام</h1>
          </div>
          <button
            onClick={onBack}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(251,249,244,0.14)", border: "1px solid rgba(251,249,244,0.35)", color: "#FBF9F4", borderRadius: 999, padding: "7px 14px", fontSize: "0.85rem", cursor: "pointer", fontFamily: "'Noto Naskh Arabic', serif" }}
          >
            <ArrowRight size={15} />
            ایڈمن پینل
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 900, margin: "0 auto", padding: "20px 16px 120px" }}>
        {/* Totals */}
        <section style={sectionStyle}>
          <p style={{ fontSize: "0.78rem", color: theme.textMuted, margin: "0 0 10px" }}>
            مقررہ ماہانہ فنڈ: <strong style={{ color: theme.primary }}>{fundConfig.monthlyFundAmount} {fundConfig.currency}</strong>
            {memberFilter !== "all" ? " — منتخب رکن کی totals" : " — تمام ریکارڈز کی totals"}
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {[
              { label: "کل فنڈ وصول", value: totals.fund },
              { label: "کل عطیات (Donations)", value: totals.donation },
              { label: "کل بقایاجات (Arrears)", value: totals.arrears },
            ].map((s) => (
              <div key={s.label} style={{ flex: "1 1 160px", border: `1px solid ${theme.border}`, borderRadius: 12, padding: "10px 12px", textAlign: "center", background: "#FDFCF9" }}>
                <div style={{ fontSize: "1.15rem", fontWeight: 700, color: theme.primary }}>{s.value} {fundConfig.currency}</div>
                <div style={{ fontSize: "0.75rem", color: theme.textMuted }}>{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Filter + Add */}
        <section style={sectionStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: showAddForm ? 14 : 0 }}>
            <div style={{ minWidth: 200 }}>
              <label style={labelStyle}>رکن کی مالی تاریخ دیکھیں (Member History)</label>
              <select style={inputStyle} value={memberFilter} onChange={(e) => setMemberFilter(e.target.value)}>
                <option value="all">تمام ممبران</option>
                {sortedMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.memberId})
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => setShowAddForm((v) => !v)}
              style={{ display: "flex", alignItems: "center", gap: 6, background: theme.primary, color: "#FBF9F4", border: "none", borderRadius: 999, padding: "8px 16px", fontSize: "0.82rem", cursor: "pointer", alignSelf: "flex-end" }}
            >
              {showAddForm ? "بند کریں" : "+ نئی ادائیگی درج کریں"}
            </button>
          </div>

          {showAddForm && (
            <div style={{ borderTop: `1px dashed ${theme.border}`, paddingTop: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                <div>
                  <label style={labelStyle}>رکن (Member)</label>
                  <select style={inputStyle} value={form.memberId} onChange={(e) => setForm((p) => ({ ...p, memberId: e.target.value }))}>
                    <option value="">منتخب کریں</option>
                    {sortedMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.memberId})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>مہینہ (Month)</label>
                  <select style={inputStyle} value={form.month} onChange={(e) => setForm((p) => ({ ...p, month: e.target.value }))}>
                    {MONTH_NAMES_UR.map((name, idx) => (
                      <option key={name} value={idx + 1}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>سال (Year)</label>
                  <input type="number" style={{ ...inputStyle, direction: "ltr" }} value={form.year} onChange={(e) => setForm((p) => ({ ...p, year: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>ادا کردہ رقم (Paid Amount)</label>
                  <input type="number" min="0" style={{ ...inputStyle, direction: "ltr" }} value={form.paidAmount} onChange={(e) => setForm((p) => ({ ...p, paidAmount: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>تاریخ ادائیگی (Payment Date)</label>
                  <input type="date" style={{ ...inputStyle, direction: "ltr" }} value={form.paymentDate} onChange={(e) => setForm((p) => ({ ...p, paymentDate: e.target.value }))} />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelStyle}>نوٹس (Notes)</label>
                  <input style={inputStyle} value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
                </div>
              </div>

              <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 10, background: "rgba(11,79,63,0.06)", fontSize: "0.8rem", display: "flex", gap: 14, flexWrap: "wrap" }}>
                <span>مقررہ فنڈ: <strong style={{ color: theme.primary }}>{fundConfig.monthlyFundAmount}</strong></span>
                <span>Paid Fund: <strong style={{ color: theme.primary }}>{liveBreakdown.paidFund}</strong></span>
                <span>Donation: <strong style={{ color: theme.primary }}>{liveBreakdown.donation}</strong></span>
                <span>Arrears: <strong style={{ color: theme.primary }}>{liveBreakdown.arrears}</strong></span>
              </div>

              <button
                onClick={addPayment}
                disabled={!form.memberId}
                style={{ marginTop: 12, background: theme.primary, color: "#FBF9F4", border: "none", borderRadius: 10, padding: "9px 18px", fontSize: "0.85rem", cursor: "pointer", opacity: form.memberId ? 1 : 0.5 }}
              >
                درج کریں
              </button>
            </div>
          )}
        </section>

        {/* Payment history */}
        <section style={sectionStyle}>
          <h2 style={{ fontFamily: "'Noto Nastaliq Urdu', serif", fontSize: "1.05rem", color: theme.primary, margin: "0 0 12px" }}>
            ادائیگیوں کی تاریخ (History)
          </h2>
          <div style={{ display: "grid", gap: 8 }}>
            {filteredPayments.length === 0 && (
              <p style={{ fontSize: "0.85rem", color: theme.textMuted, textAlign: "center", margin: 0 }}>ابھی کوئی ریکارڈ موجود نہیں۔</p>
            )}
            {filteredPayments.map((p) => (
              <div key={p.id} style={{ border: `1px solid ${theme.border}`, borderRadius: 12, padding: 10, background: "#FDFCF9", fontSize: "0.8rem" }}>
                {editingId === p.id ? (
                  <div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
                      <div>
                        <label style={labelStyle}>رکن (Member)</label>
                        <select style={inputStyle} value={editForm.memberId} onChange={(e) => setEditForm((p2) => ({ ...p2, memberId: e.target.value }))}>
                          {sortedMembers.map((m) => (
                            <option key={m.id} value={m.id}>{m.name} ({m.memberId})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>مہینہ (Month)</label>
                        <select style={inputStyle} value={editForm.month} onChange={(e) => setEditForm((p2) => ({ ...p2, month: e.target.value }))}>
                          {MONTH_NAMES_UR.map((name, idx) => (
                            <option key={name} value={idx + 1}>{name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>سال (Year)</label>
                        <input type="number" style={{ ...inputStyle, direction: "ltr" }} value={editForm.year} onChange={(e) => setEditForm((p2) => ({ ...p2, year: e.target.value }))} />
                      </div>
                      <div>
                        <label style={labelStyle}>ادا کردہ رقم (Paid Amount)</label>
                        <input type="number" min="0" style={{ ...inputStyle, direction: "ltr" }} value={editForm.paidAmount} onChange={(e) => setEditForm((p2) => ({ ...p2, paidAmount: e.target.value }))} />
                      </div>
                      <div>
                        <label style={labelStyle}>تاریخ ادائیگی (Payment Date)</label>
                        <input type="date" style={{ ...inputStyle, direction: "ltr" }} value={editForm.paymentDate} onChange={(e) => setEditForm((p2) => ({ ...p2, paymentDate: e.target.value }))} />
                      </div>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <label style={labelStyle}>نوٹس (Notes)</label>
                        <input style={inputStyle} value={editForm.notes} onChange={(e) => setEditForm((p2) => ({ ...p2, notes: e.target.value }))} />
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <button onClick={() => saveEdit(p.id)} style={{ background: theme.primary, color: "#FBF9F4", border: "none", borderRadius: 9, padding: "7px 14px", fontSize: "0.8rem", cursor: "pointer" }}>
                        محفوظ کریں
                      </button>
                      <button onClick={() => { setEditingId(null); setEditForm(null); }} style={{ background: "#fff", border: `1px solid ${theme.border}`, color: theme.textMuted, borderRadius: 9, padding: "7px 14px", fontSize: "0.8rem", cursor: "pointer" }}>
                        منسوخ
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                      <strong>{memberLabel(p.memberId)}</strong>
                      <span style={{ color: theme.textMuted }}>{MONTH_NAMES_UR[p.month - 1]} {p.year} · {p.paymentDate}</span>
                    </div>
                    <div style={{ marginTop: 4, color: theme.textMuted, display: "flex", gap: 12, flexWrap: "wrap" }}>
                      <span>ادا کردہ: <strong style={{ color: theme.textStrong }}>{p.paidAmount}</strong></span>
                      <span>Paid Fund: <strong style={{ color: theme.primary }}>{p.paidFund}</strong></span>
                      <span>Donation: <strong style={{ color: theme.primary }}>{p.donation}</strong></span>
                      <span>Arrears: <strong style={{ color: theme.primary }}>{p.arrears}</strong></span>
                    </div>
                    {p.notes && <div style={{ marginTop: 4, color: theme.textMuted, fontSize: "0.75rem" }}>{p.notes}</div>}
                    <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                      <button onClick={() => startEdit(p)} style={{ border: `1px solid ${theme.border}`, background: "#fff", color: theme.primary, borderRadius: 999, padding: "5px 11px", fontSize: "0.72rem", cursor: "pointer" }}>
                        ترمیم
                      </button>
                      <button onClick={() => deletePayment(p)} style={{ border: "none", background: "rgba(178,52,52,0.1)", color: "#B23434", borderRadius: 999, padding: "5px 11px", fontSize: "0.72rem", cursor: "pointer" }}>
                        مستقل حذف کریں
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Deletion audit trail */}
        {draftDeletionLog.length > 0 && (
          <section style={sectionStyle}>
            <h2 style={{ fontFamily: "'Noto Nastaliq Urdu', serif", fontSize: "1.05rem", color: theme.primary, margin: "0 0 12px" }}>
              حذف شدہ Entries کا ریکارڈ (Audit Trail)
            </h2>
            <div style={{ display: "grid", gap: 6 }}>
              {draftDeletionLog.slice(0, 20).map((d) => (
                <div key={d.id} style={{ fontSize: "0.75rem", color: theme.textMuted, borderBottom: `1px dashed ${theme.border}`, paddingBottom: 6 }}>
                  {memberLabel(d.memberId)} — {d.amount} {fundConfig.currency} — حذف کی تاریخ: {new Date(d.deletedAt).toLocaleString("en-GB")}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <div style={{ position: "fixed", bottom: 0, insetInlineStart: 0, insetInlineEnd: 0, background: "#FFFFFF", borderTop: `1px solid ${theme.border}`, padding: "12px 16px", display: "flex", justifyContent: "center", gap: 12, boxShadow: "0 -6px 16px rgba(31,42,36,0.08)", zIndex: 25 }}>
        {savedFlash && (
          <span style={{ display: "flex", alignItems: "center", gap: 6, color: theme.primary, fontSize: "0.85rem", alignSelf: "center" }}>
            <CheckCircle2 size={16} /> تبدیلیاں کامیابی سے محفوظ ہوگئیں
          </span>
        )}
        <button
          onClick={handleSave}
          style={{ display: "flex", alignItems: "center", gap: 8, background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryDark} 100%)`, color: "#FBF9F4", border: "none", borderRadius: 12, padding: "12px 28px", fontSize: "0.95rem", fontFamily: "'Noto Naskh Arabic', serif", cursor: "pointer", boxShadow: "0 6px 16px rgba(11,79,63,0.28)" }}
        >
          <Save size={17} />
          تبدیلیاں محفوظ کریں
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   EXPENSES MANAGEMENT (Phase 1B — Expenses)
   ------------------------------------------------------------
   Same no-database, draft-then-Save pattern as the other admin
   screens. Expenses are never deleted — only 'archived' (kept
   for audit, excluded from totals) — matching the Members and
   Payments pattern of preserving history.

   Field shapes here are deliberately simple numbers/strings so
   that a future summary of:
     Balance = Total Paid Fund + Total Donations - Total Expenses
   can be computed by combining this module's totals with
   FundsManagement's totals — no restructuring needed later.
   ============================================================ */
function emptyExpenseForm() {
  const now = new Date();
  return {
    title: "",
    category: "",
    amount: "",
    date: now.toISOString().slice(0, 10),
    notes: "",
  };
}

function ExpensesManagement({ theme, expenses, currency, onApply, onBack }) {
  const [draftExpenses, setDraftExpenses] = useState(expenses);
  const [savedFlash, setSavedFlash] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState(emptyExpenseForm());
  const [statusFilter, setStatusFilter] = useState("active"); // active | archived | all
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(emptyExpenseForm());

  const now = new Date();
  const [summaryMonth, setSummaryMonth] = useState(now.getMonth() + 1);
  const [summaryYear, setSummaryYear] = useState(now.getFullYear());

  const activeExpenses = draftExpenses.filter((e) => e.status === "active");

  const totalAll = activeExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalMonth = activeExpenses
    .filter((e) => {
      const d = new Date(e.date);
      return d.getMonth() + 1 === Number(summaryMonth) && d.getFullYear() === Number(summaryYear);
    })
    .reduce((sum, e) => sum + e.amount, 0);
  const totalYear = activeExpenses
    .filter((e) => new Date(e.date).getFullYear() === Number(summaryYear))
    .reduce((sum, e) => sum + e.amount, 0);

  const visibleExpenses = (statusFilter === "all" ? draftExpenses : draftExpenses.filter((e) => e.status === statusFilter))
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  function handleSave() {
    onApply(draftExpenses);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2500);
  }

  function addExpense() {
    if (!form.title.trim() || !form.amount) return;
    const record = {
      id: `expense-${Date.now()}`,
      title: form.title.trim(),
      category: form.category.trim() || "عمومی",
      amount: Number(form.amount) || 0,
      date: form.date,
      notes: form.notes.trim(),
      status: "active",
    };
    setDraftExpenses((prev) => [record, ...prev]);
    setForm(emptyExpenseForm());
    setShowAddForm(false);
  }

  function startEdit(expense) {
    setEditingId(expense.id);
    setEditForm({
      title: expense.title,
      category: expense.category,
      amount: String(expense.amount),
      date: expense.date,
      notes: expense.notes,
    });
  }

  function saveEdit(id) {
    setDraftExpenses((prev) =>
      prev.map((e) =>
        e.id === id
          ? {
              ...e,
              title: editForm.title.trim() || e.title,
              category: editForm.category.trim() || e.category,
              amount: Number(editForm.amount) || 0,
              date: editForm.date,
              notes: editForm.notes.trim(),
            }
          : e
      )
    );
    setEditingId(null);
  }

  function setStatus(id, status) {
    setDraftExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, status } : e)));
  }

  const sectionStyle = {
    background: "#FFFFFF",
    border: `1px solid ${theme.border}`,
    borderRadius: 16,
    padding: "16px",
    marginBottom: 16,
    boxShadow: "0 1px 2px rgba(31,42,36,0.06)",
  };
  const labelStyle = { display: "block", fontSize: "0.78rem", color: theme.textMuted, marginBottom: 4 };
  const inputStyle = {
    width: "100%",
    boxSizing: "border-box",
    padding: "9px 10px",
    borderRadius: 9,
    border: `1px solid ${theme.border}`,
    fontFamily: "'Noto Naskh Arabic', serif",
    fontSize: "0.9rem",
    color: theme.textStrong,
    background: "#FDFCF9",
    marginBottom: 0,
  };

  function MemberFormLikeFields({ f, setF }) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
        <div>
          <label style={labelStyle}>عنوان (Title)</label>
          <input style={inputStyle} value={f.title} onChange={(e) => setF((p) => ({ ...p, title: e.target.value }))} />
        </div>
        <div>
          <label style={labelStyle}>Category</label>
          <input style={inputStyle} value={f.category} onChange={(e) => setF((p) => ({ ...p, category: e.target.value }))} placeholder="مثلاً: تقریبات، دیکھ بھال" />
        </div>
        <div>
          <label style={labelStyle}>رقم (Amount)</label>
          <input type="number" min="0" style={{ ...inputStyle, direction: "ltr" }} value={f.amount} onChange={(e) => setF((p) => ({ ...p, amount: e.target.value }))} />
        </div>
        <div>
          <label style={labelStyle}>تاریخ (Date)</label>
          <input type="date" style={{ ...inputStyle, direction: "ltr" }} value={f.date} onChange={(e) => setF((p) => ({ ...p, date: e.target.value }))} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>تفصیل/نوٹس (Description/Notes)</label>
          <input style={inputStyle} value={f.notes} onChange={(e) => setF((p) => ({ ...p, notes: e.target.value }))} />
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" lang="ur" style={{ minHeight: "100vh", background: `linear-gradient(180deg, ${theme.background} 0%, ${theme.backgroundAlt} 100%)`, fontFamily: "'Noto Naskh Arabic', serif", color: theme.textStrong }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400..700&family=Noto+Naskh+Arabic:wght@400..700&display=swap');`}</style>

      <header style={{ background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryDark} 100%)`, color: "#FBF9F4", position: "sticky", top: 0, zIndex: 20, padding: "14px 18px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Receipt size={20} />
            <h1 style={{ fontFamily: "'Noto Nastaliq Urdu', serif", fontSize: "1.15rem", margin: 0 }}>اخراجات کا انتظام</h1>
          </div>
          <button
            onClick={onBack}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(251,249,244,0.14)", border: "1px solid rgba(251,249,244,0.35)", color: "#FBF9F4", borderRadius: 999, padding: "7px 14px", fontSize: "0.85rem", cursor: "pointer", fontFamily: "'Noto Naskh Arabic', serif" }}
          >
            <ArrowRight size={15} />
            ایڈمن پینل
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 900, margin: "0 auto", padding: "20px 16px 120px" }}>
        {/* Totals */}
        <section style={sectionStyle}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>مہینہ منتخب کریں</label>
              <select style={{ ...inputStyle, maxWidth: 140 }} value={summaryMonth} onChange={(e) => setSummaryMonth(e.target.value)}>
                {MONTH_NAMES_UR.map((name, idx) => (
                  <option key={name} value={idx + 1}>{name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>سال منتخب کریں</label>
              <input type="number" style={{ ...inputStyle, maxWidth: 110, direction: "ltr" }} value={summaryYear} onChange={(e) => setSummaryYear(e.target.value)} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {[
              { label: "کل اخراجات (Total)", value: totalAll },
              { label: "منتخب مہینے کے اخراجات", value: totalMonth },
              { label: "منتخب سال کے اخراجات", value: totalYear },
            ].map((s) => (
              <div key={s.label} style={{ flex: "1 1 160px", border: `1px solid ${theme.border}`, borderRadius: 12, padding: "10px 12px", textAlign: "center", background: "#FDFCF9" }}>
                <div style={{ fontSize: "1.15rem", fontWeight: 700, color: theme.primary }}>{s.value} {currency}</div>
                <div style={{ fontSize: "0.75rem", color: theme.textMuted }}>{s.label}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: "0.72rem", color: theme.textMuted, marginTop: 10, marginBottom: 0 }}>
            آرکائیو شدہ اخراجات ان totals میں شامل نہیں کیے جاتے۔
          </p>
        </section>

        {/* Filter + Add */}
        <section style={sectionStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: showAddForm ? 14 : 0 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[
                ["active", "فعال"],
                ["archived", "آرکائیو"],
                ["all", "سب"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setStatusFilter(key)}
                  style={{
                    border: `1px solid ${theme.border}`,
                    borderRadius: 999,
                    padding: "6px 12px",
                    fontSize: "0.78rem",
                    cursor: "pointer",
                    background: statusFilter === key ? theme.primary : "#FDFCF9",
                    color: statusFilter === key ? "#FBF9F4" : theme.textStrong,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowAddForm((v) => !v)}
              style={{ display: "flex", alignItems: "center", gap: 6, background: theme.primary, color: "#FBF9F4", border: "none", borderRadius: 999, padding: "8px 16px", fontSize: "0.82rem", cursor: "pointer" }}
            >
              {showAddForm ? "بند کریں" : "+ نیا Expense شامل کریں"}
            </button>
          </div>

          {showAddForm && (
            <div style={{ borderTop: `1px dashed ${theme.border}`, paddingTop: 14 }}>
              {MemberFormLikeFields({ f: form, setF: setForm })}
              <button
                onClick={addExpense}
                disabled={!form.title.trim() || !form.amount}
                style={{ marginTop: 10, background: theme.primary, color: "#FBF9F4", border: "none", borderRadius: 10, padding: "9px 18px", fontSize: "0.85rem", cursor: "pointer", opacity: form.title.trim() && form.amount ? 1 : 0.5 }}
              >
                شامل کریں
              </button>
            </div>
          )}
        </section>

        {/* Expenses list */}
        <section style={sectionStyle}>
          <h2 style={{ fontFamily: "'Noto Nastaliq Urdu', serif", fontSize: "1.05rem", color: theme.primary, margin: "0 0 12px" }}>
            اخراجات کی فہرست (History)
          </h2>
          <div style={{ display: "grid", gap: 10 }}>
            {visibleExpenses.length === 0 && (
              <p style={{ fontSize: "0.85rem", color: theme.textMuted, textAlign: "center", margin: 0 }}>اس فہرست میں کوئی Expense موجود نہیں۔</p>
            )}
            {visibleExpenses.map((expense) => (
              <div key={expense.id} style={{ border: `1px solid ${theme.border}`, borderRadius: 12, padding: 12, background: "#FDFCF9" }}>
                {editingId === expense.id ? (
                  <div>
                    {MemberFormLikeFields({ f: editForm, setF: setEditForm })}
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <button onClick={() => saveEdit(expense.id)} style={{ background: theme.primary, color: "#FBF9F4", border: "none", borderRadius: 9, padding: "7px 14px", fontSize: "0.8rem", cursor: "pointer" }}>
                        محفوظ کریں
                      </button>
                      <button onClick={() => setEditingId(null)} style={{ background: "#fff", border: `1px solid ${theme.border}`, color: theme.textMuted, borderRadius: 9, padding: "7px 14px", fontSize: "0.8rem", cursor: "pointer" }}>
                        منسوخ
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700 }}>{expense.title}</span>
                        <span style={{ background: "rgba(11,79,63,0.08)", color: theme.primary, borderRadius: 999, padding: "3px 10px", fontSize: "0.72rem" }}>{expense.category}</span>
                        {expense.status === "archived" && (
                          <span style={{ background: "rgba(91,107,98,0.14)", color: theme.textMuted, borderRadius: 999, padding: "3px 10px", fontSize: "0.72rem" }}>آرکائیو شدہ</span>
                        )}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: theme.textMuted, marginTop: 2 }}>
                        {expense.amount} {currency} · {expense.date}
                      </div>
                      {expense.notes && <div style={{ fontSize: "0.72rem", color: theme.textMuted, marginTop: 2 }}>{expense.notes}</div>}
                    </div>

                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button onClick={() => startEdit(expense)} style={{ border: `1px solid ${theme.border}`, background: "#fff", color: theme.primary, borderRadius: 999, padding: "5px 11px", fontSize: "0.72rem", cursor: "pointer" }}>
                        ترمیم
                      </button>
                      {expense.status === "active" ? (
                        <button onClick={() => setStatus(expense.id, "archived")} style={{ border: "none", background: "rgba(91,107,98,0.14)", color: theme.textMuted, borderRadius: 999, padding: "5px 11px", fontSize: "0.72rem", cursor: "pointer" }}>
                          آرکائیو کریں
                        </button>
                      ) : (
                        <button onClick={() => setStatus(expense.id, "active")} style={{ border: "none", background: "rgba(11,79,63,0.1)", color: theme.primary, borderRadius: 999, padding: "5px 11px", fontSize: "0.72rem", cursor: "pointer" }}>
                          بحال کریں
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>

      <div style={{ position: "fixed", bottom: 0, insetInlineStart: 0, insetInlineEnd: 0, background: "#FFFFFF", borderTop: `1px solid ${theme.border}`, padding: "12px 16px", display: "flex", justifyContent: "center", gap: 12, boxShadow: "0 -6px 16px rgba(31,42,36,0.08)", zIndex: 25 }}>
        {savedFlash && (
          <span style={{ display: "flex", alignItems: "center", gap: 6, color: theme.primary, fontSize: "0.85rem", alignSelf: "center" }}>
            <CheckCircle2 size={16} /> تبدیلیاں کامیابی سے محفوظ ہوگئیں
          </span>
        )}
        <button
          onClick={handleSave}
          style={{ display: "flex", alignItems: "center", gap: 8, background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryDark} 100%)`, color: "#FBF9F4", border: "none", borderRadius: 12, padding: "12px 28px", fontSize: "0.95rem", fontFamily: "'Noto Naskh Arabic', serif", cursor: "pointer", boxShadow: "0 6px 16px rgba(11,79,63,0.28)" }}
        >
          <Save size={17} />
          تبدیلیاں محفوظ کریں
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   FINANCIAL SUMMARY / BALANCE (Phase 1B — Summary)
   ------------------------------------------------------------
   Read-only view — it does not own any state, only reads the
   existing `payments` and `expenses` records that FundsManagement
   and ExpensesManagement already maintain. No historical record
   (Required Fund snapshots, member history, expense records) is
   touched here.

   Rules preserved exactly as before:
   - Paid Fund and Donation stay separate (from computeFundBreakdown
     results already stored per payment — not recalculated here).
   - Archived expenses are excluded from Total Expenses.
   - Balance = (Total Paid Fund + Total Donations) - Total Expenses.
   ============================================================ */
function inRange(dateStr, start, end) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (start && d < new Date(start)) return false;
  if (end && d > new Date(end)) return false;
  return true;
}

function FinancialSummary({ theme, payments, expenses, currency, onBack }) {
  const now = new Date();
  const [filterMode, setFilterMode] = useState("all"); // all | month | year | range
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");

  const activeExpenses = expenses.filter((e) => e.status === "active");

  let filteredPayments = payments;
  let filteredExpenses = activeExpenses;

  if (filterMode === "month") {
    filteredPayments = payments.filter((p) => p.month === Number(filterMonth) && p.year === Number(filterYear));
    filteredExpenses = activeExpenses.filter((e) => {
      const d = new Date(e.date);
      return d.getMonth() + 1 === Number(filterMonth) && d.getFullYear() === Number(filterYear);
    });
  } else if (filterMode === "year") {
    filteredPayments = payments.filter((p) => p.year === Number(filterYear));
    filteredExpenses = activeExpenses.filter((e) => new Date(e.date).getFullYear() === Number(filterYear));
  } else if (filterMode === "range") {
    filteredPayments = payments.filter((p) => inRange(p.paymentDate, rangeStart, rangeEnd));
    filteredExpenses = activeExpenses.filter((e) => inRange(e.date, rangeStart, rangeEnd));
  }

  const totalPaidFund = filteredPayments.reduce((s, p) => s + p.paidFund, 0);
  const totalDonations = filteredPayments.reduce((s, p) => s + p.donation, 0);
  const totalArrears = filteredPayments.reduce((s, p) => s + p.arrears, 0);
  const totalIncome = totalPaidFund + totalDonations;
  const totalExpenses = filteredExpenses.reduce((s, e) => s + e.amount, 0);
  const balance = totalIncome - totalExpenses;

  const expenseByCategory = filteredExpenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {});
  const categoryRows = Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1]);
  const maxCategoryAmount = categoryRows.length ? categoryRows[0][1] : 0;

  const incomeRows = [
    { label: "Paid Fund", value: totalPaidFund },
    { label: "Donations", value: totalDonations },
  ];
  const maxIncomeAmount = Math.max(totalPaidFund, totalDonations, 1);

  const sectionStyle = {
    background: "#FFFFFF",
    border: `1px solid ${theme.border}`,
    borderRadius: 16,
    padding: "16px",
    marginBottom: 16,
    boxShadow: "0 1px 2px rgba(31,42,36,0.06)",
  };
  const labelStyle = { display: "block", fontSize: "0.78rem", color: theme.textMuted, marginBottom: 4 };
  const inputStyle = {
    boxSizing: "border-box",
    padding: "9px 10px",
    borderRadius: 9,
    border: `1px solid ${theme.border}`,
    fontFamily: "'Noto Naskh Arabic', serif",
    fontSize: "0.9rem",
    color: theme.textStrong,
    background: "#FDFCF9",
  };

  function statCard(label, value, color) {
    return (
      <div style={{ flex: "1 1 150px", border: `1px solid ${theme.border}`, borderRadius: 12, padding: "12px", textAlign: "center", background: "#FDFCF9" }}>
        <div style={{ fontSize: "1.25rem", fontWeight: 700, color: color || theme.primary }}>{value} {currency}</div>
        <div style={{ fontSize: "0.75rem", color: theme.textMuted, marginTop: 2 }}>{label}</div>
      </div>
    );
  }

  function barRow(label, value, max, color) {
    const pct = max > 0 ? Math.round((value / max) * 100) : 0;
    return (
      <div key={label} style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: 4 }}>
          <span>{label}</span>
          <strong style={{ color: theme.primary }}>{value} {currency}</strong>
        </div>
        <div style={{ height: 8, borderRadius: 999, background: "rgba(11,79,63,0.08)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: color || theme.primary, borderRadius: 999 }} />
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" lang="ur" style={{ minHeight: "100vh", background: `linear-gradient(180deg, ${theme.background} 0%, ${theme.backgroundAlt} 100%)`, fontFamily: "'Noto Naskh Arabic', serif", color: theme.textStrong }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400..700&family=Noto+Naskh+Arabic:wght@400..700&display=swap');`}</style>

      <header style={{ background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryDark} 100%)`, color: "#FBF9F4", position: "sticky", top: 0, zIndex: 20, padding: "14px 18px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <FileBarChart size={20} />
            <h1 style={{ fontFamily: "'Noto Nastaliq Urdu', serif", fontSize: "1.15rem", margin: 0 }}>مالی خلاصہ (Financial Summary)</h1>
          </div>
          <button
            onClick={onBack}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(251,249,244,0.14)", border: "1px solid rgba(251,249,244,0.35)", color: "#FBF9F4", borderRadius: 999, padding: "7px 14px", fontSize: "0.85rem", cursor: "pointer", fontFamily: "'Noto Naskh Arabic', serif" }}
          >
            <ArrowRight size={15} />
            ایڈمن پینل
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 900, margin: "0 auto", padding: "20px 16px 60px" }}>
        {/* Filters */}
        <section style={sectionStyle}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            {[
              ["all", "All Time"],
              ["month", "Selected Month"],
              ["year", "Selected Year"],
              ["range", "Custom Date Range"],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilterMode(key)}
                style={{
                  border: `1px solid ${theme.border}`,
                  borderRadius: 999,
                  padding: "6px 14px",
                  fontSize: "0.78rem",
                  cursor: "pointer",
                  background: filterMode === key ? theme.primary : "#FDFCF9",
                  color: filterMode === key ? "#FBF9F4" : theme.textStrong,
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {filterMode === "month" && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div>
                <label style={labelStyle}>مہینہ</label>
                <select style={inputStyle} value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}>
                  {MONTH_NAMES_UR.map((name, idx) => (
                    <option key={name} value={idx + 1}>{name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>سال</label>
                <input type="number" style={{ ...inputStyle, direction: "ltr", maxWidth: 110 }} value={filterYear} onChange={(e) => setFilterYear(e.target.value)} />
              </div>
            </div>
          )}

          {filterMode === "year" && (
            <div>
              <label style={labelStyle}>سال</label>
              <input type="number" style={{ ...inputStyle, direction: "ltr", maxWidth: 110 }} value={filterYear} onChange={(e) => setFilterYear(e.target.value)} />
            </div>
          )}

          {filterMode === "range" && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div>
                <label style={labelStyle}>شروع تاریخ</label>
                <input type="date" style={{ ...inputStyle, direction: "ltr" }} value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>آخری تاریخ</label>
                <input type="date" style={{ ...inputStyle, direction: "ltr" }} value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} />
              </div>
            </div>
          )}
        </section>

        {/* Top-line totals */}
        <section style={sectionStyle}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {statCard("Total Paid Fund", totalPaidFund)}
            {statCard("Total Donations", totalDonations)}
            {statCard("Total Income", totalIncome)}
            {statCard("Total Expenses", totalExpenses, theme.accent)}
            {statCard("Balance", balance, balance >= 0 ? theme.primary : theme.accent)}
            {statCard("Total Arrears", totalArrears, theme.accent)}
          </div>
          <p style={{ fontSize: "0.72rem", color: theme.textMuted, marginTop: 10, marginBottom: 0 }}>
            Balance = Total Income (Paid Fund + Donations) − Total Expenses۔ آرکائیو شدہ اخراجات شامل نہیں۔
          </p>
        </section>

        {/* Income breakdown */}
        <section style={sectionStyle}>
          <h2 style={{ fontFamily: "'Noto Nastaliq Urdu', serif", fontSize: "1.05rem", color: theme.primary, margin: "0 0 12px" }}>
            آمدنی کہاں سے آئی (Income Breakdown)
          </h2>
          {incomeRows.map((r) => barRow(r.label, r.value, maxIncomeAmount))}
        </section>

        {/* Expense breakdown */}
        <section style={sectionStyle}>
          <h2 style={{ fontFamily: "'Noto Nastaliq Urdu', serif", fontSize: "1.05rem", color: theme.primary, margin: "0 0 12px" }}>
            خرچ کہاں ہوا (Expense Breakdown by Category)
          </h2>
          {categoryRows.length === 0 ? (
            <p style={{ fontSize: "0.85rem", color: theme.textMuted, margin: 0 }}>اس مدت میں کوئی Expense موجود نہیں۔</p>
          ) : (
            categoryRows.map(([category, amount]) => barRow(category, amount, maxCategoryAmount, theme.accent))
          )}
        </section>
      </main>
    </div>
  );
}

/* ============================================================
   DASTOOR / CONSTITUTION — shared numbering helper
   ------------------------------------------------------------
   Chapter/clause numbers (باب ۱، دفعہ ۱.۱ …) are always derived
   here from `order` among active items — never stored — so
   reordering/archiving never requires renumbering saved data.
   ============================================================ */
function buildDastoorStructure(chapters, clauses, includeArchived) {
  const chapterList = (includeArchived ? chapters : chapters.filter((c) => c.status === "active"))
    .slice()
    .sort((a, b) => a.order - b.order);

  return chapterList.map((chapter, chapterIdx) => {
    const chapterClauses = (includeArchived ? clauses : clauses.filter((cl) => cl.status === "active"))
      .filter((cl) => cl.chapterId === chapter.id)
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((clause, clauseIdx) => ({ ...clause, number: `${chapterIdx + 1}.${clauseIdx + 1}` }));
    return { ...chapter, number: chapterIdx + 1, clauses: chapterClauses };
  });
}

/* ============================================================
   PUBLIC DASTOOR VIEW (Phase 1B — Dastoor / Constitution)
   ------------------------------------------------------------
   Read-only. Reads the same `dastoorChapters`/`dastoorClauses`
   state that DastoorManagement maintains — no separate copy of
   the data.
   ============================================================ */
function DastoorPage({ theme, card, chapters, clauses, onBack }) {
  const structure = buildDastoorStructure(chapters, clauses, false);

  return (
    <div dir="rtl" lang="ur" style={{ minHeight: "100vh", background: `linear-gradient(180deg, ${theme.background} 0%, ${theme.backgroundAlt} 100%)`, fontFamily: "'Noto Naskh Arabic', serif", color: theme.textStrong }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400..700&family=Noto+Naskh+Arabic:wght@400..700&display=swap'); .kw-heading { font-family: 'Noto Nastaliq Urdu', serif; }`}</style>

      <header style={{ background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryDark} 100%)`, color: "#FBF9F4", position: "sticky", top: 0, zIndex: 20, padding: "14px 18px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <BookOpenText size={20} />
            <h1 className="kw-heading" style={{ fontSize: "1.15rem", margin: 0 }}>{card.title}</h1>
          </div>
          <button
            onClick={onBack}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(251,249,244,0.14)", border: "1px solid rgba(251,249,244,0.35)", color: "#FBF9F4", borderRadius: 999, padding: "7px 14px", fontSize: "0.85rem", cursor: "pointer", fontFamily: "'Noto Naskh Arabic', serif" }}
          >
            <ArrowRight size={15} />
            ہوم پیج پر واپس جائیں
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 760, margin: "0 auto", padding: "28px 18px 60px" }}>
        {structure.length === 0 && (
          <p style={{ textAlign: "center", color: theme.textMuted, fontSize: "0.9rem" }}>
            دستور ابھی شامل نہیں کیا گیا۔
          </p>
        )}
        {structure.map((chapter) => (
          <section key={chapter.id} style={{ marginBottom: 28 }}>
            <h2 className="kw-heading" style={{ fontSize: "1.25rem", color: theme.primary, borderBottom: `2px solid ${theme.border}`, paddingBottom: 8, marginBottom: 12 }}>
              {chapter.title}
            </h2>
            {chapter.clauses.length === 0 ? (
              <p style={{ color: theme.textMuted, fontSize: "0.85rem" }}>اس باب میں ابھی کوئی دفعہ شامل نہیں۔</p>
            ) : (
              chapter.clauses.map((clause) => (
                <div key={clause.id} style={{ marginBottom: 14, paddingInlineStart: 4 }}>
                  <h3 style={{ fontSize: "0.98rem", color: theme.textStrong, margin: "0 0 4px" }}>
                    {clause.title}
                  </h3>
                  <p
                    style={{
                      fontSize: "0.88rem",
                      color: theme.textMuted,
                      lineHeight: 2,
                      margin: 0,
                      whiteSpace: "pre-line",
                      overflowWrap: "break-word",
                      wordBreak: "break-word",
                    }}
                  >
                    {clause.text}
                  </p>
                </div>
              ))
            )}
          </section>
        ))}
      </main>
    </div>
  );
}

/* ============================================================
   SUPER ADMIN DASTOOR MANAGEMENT
   ------------------------------------------------------------
   Same no-database, draft-then-Save pattern as the other admin
   screens. Chapters/clauses are never deleted — only 'archived'
   (excluded from the public view and from active numbering, but
   never wiped) so nothing already referenced elsewhere is lost.
   ============================================================ */
function DastoorManagement({ theme, chapters, clauses, onApply, onBack }) {
  const [draftChapters, setDraftChapters] = useState(chapters);
  const [draftClauses, setDraftClauses] = useState(clauses);
  const [savedFlash, setSavedFlash] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState("");
  const [clauseForms, setClauseForms] = useState({}); // chapterId -> { title, text }
  const [expandedChapterId, setExpandedChapterId] = useState(null);

  const sortedChapters = [...draftChapters].sort((a, b) => a.order - b.order);
  const activeSorted = sortedChapters.filter((c) => c.status === "active");

  function clausesForChapter(chapterId) {
    return draftClauses.filter((cl) => cl.chapterId === chapterId).sort((a, b) => a.order - b.order);
  }

  function handleSave() {
    onApply(draftChapters, draftClauses);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2500);
  }

  function addChapter() {
    if (!newChapterTitle.trim()) return;
    const maxOrder = draftChapters.reduce((m, c) => Math.max(m, c.order), 0);
    setDraftChapters((prev) => [...prev, { id: `chapter-${Date.now()}`, order: maxOrder + 1, status: "active", title: newChapterTitle.trim() }]);
    setNewChapterTitle("");
  }

  function updateChapterTitle(id, title) {
    setDraftChapters((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
  }

  function setChapterStatus(id, status) {
    setDraftChapters((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
  }

  function deleteChapter(id) {
    if (!window.confirm("کیا آپ واقعی یہ Dastoor entry حذف کرنا چاہتے ہیں؟")) return;
    setDraftChapters((prev) => prev.filter((c) => c.id !== id));
    // Clauses belonging to a deleted chapter become orphaned data if left
    // behind, so remove them too. Any Notice that referenced one of these
    // clauses/chapters is NOT touched or deleted — dastoorRefLabel() already
    // safely returns null for a missing chapter/clause id, so the Notice
    // just stops showing that reference line instead of breaking.
    setDraftClauses((prev) => prev.filter((cl) => cl.chapterId !== id));
  }

  function moveChapter(id, direction) {
    setDraftChapters((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((c) => c.id === id);
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= sorted.length) return prev;
      const a = sorted[idx];
      const b = sorted[swapIdx];
      return prev.map((c) => {
        if (c.id === a.id) return { ...c, order: b.order };
        if (c.id === b.id) return { ...c, order: a.order };
        return c;
      });
    });
  }

  function addClause(chapterId) {
    const form = clauseForms[chapterId] || { title: "", text: "" };
    if (!form.title.trim()) return;
    const existing = draftClauses.filter((cl) => cl.chapterId === chapterId);
    const maxOrder = existing.reduce((m, cl) => Math.max(m, cl.order), 0);
    setDraftClauses((prev) => [
      ...prev,
      { id: `clause-${Date.now()}`, chapterId, order: maxOrder + 1, status: "active", title: form.title.trim(), text: form.text.trim() },
    ]);
    setClauseForms((prev) => ({ ...prev, [chapterId]: { title: "", text: "" } }));
  }

  function updateClause(id, patch) {
    setDraftClauses((prev) => prev.map((cl) => (cl.id === id ? { ...cl, ...patch } : cl)));
  }

  function setClauseStatus(id, status) {
    setDraftClauses((prev) => prev.map((cl) => (cl.id === id ? { ...cl, status } : cl)));
  }

  function deleteClause(id) {
    if (!window.confirm("کیا آپ واقعی یہ Dastoor entry حذف کرنا چاہتے ہیں؟")) return;
    setDraftClauses((prev) => prev.filter((cl) => cl.id !== id));
  }

  function moveClause(chapterId, id, direction) {
    setDraftClauses((prev) => {
      const sorted = prev.filter((cl) => cl.chapterId === chapterId).sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((cl) => cl.id === id);
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= sorted.length) return prev;
      const a = sorted[idx];
      const b = sorted[swapIdx];
      return prev.map((cl) => {
        if (cl.id === a.id) return { ...cl, order: b.order };
        if (cl.id === b.id) return { ...cl, order: a.order };
        return cl;
      });
    });
  }

  const sectionStyle = {
    background: "#FFFFFF",
    border: `1px solid ${theme.border}`,
    borderRadius: 16,
    padding: "16px",
    marginBottom: 16,
    boxShadow: "0 1px 2px rgba(31,42,36,0.06)",
  };
  const labelStyle = { display: "block", fontSize: "0.78rem", color: theme.textMuted, marginBottom: 4 };
  const inputStyle = {
    width: "100%",
    boxSizing: "border-box",
    padding: "9px 10px",
    borderRadius: 9,
    border: `1px solid ${theme.border}`,
    fontFamily: "'Noto Naskh Arabic', serif",
    fontSize: "0.9rem",
    color: theme.textStrong,
    background: "#FDFCF9",
    marginBottom: 0,
  };

  return (
    <div dir="rtl" lang="ur" style={{ minHeight: "100vh", background: `linear-gradient(180deg, ${theme.background} 0%, ${theme.backgroundAlt} 100%)`, fontFamily: "'Noto Naskh Arabic', serif", color: theme.textStrong }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400..700&family=Noto+Naskh+Arabic:wght@400..700&display=swap');`}</style>

      <header style={{ background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryDark} 100%)`, color: "#FBF9F4", position: "sticky", top: 0, zIndex: 20, padding: "14px 18px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <BookOpenText size={20} />
            <h1 style={{ fontFamily: "'Noto Nastaliq Urdu', serif", fontSize: "1.15rem", margin: 0 }}>دستور کا انتظام</h1>
          </div>
          <button
            onClick={onBack}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(251,249,244,0.14)", border: "1px solid rgba(251,249,244,0.35)", color: "#FBF9F4", borderRadius: 999, padding: "7px 14px", fontSize: "0.85rem", cursor: "pointer", fontFamily: "'Noto Naskh Arabic', serif" }}
          >
            <ArrowRight size={15} />
            ایڈمن پینل
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 900, margin: "0 auto", padding: "20px 16px 120px" }}>
        {/* Add chapter */}
        <section style={sectionStyle}>
          <h2 style={{ fontFamily: "'Noto Nastaliq Urdu', serif", fontSize: "1.05rem", color: theme.primary, margin: "0 0 12px" }}>
            نیا باب شامل کریں
          </h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input style={{ ...inputStyle, flex: "1 1 220px" }} placeholder="باب کا عنوان" value={newChapterTitle} onChange={(e) => setNewChapterTitle(e.target.value)} />
            <button
              onClick={addChapter}
              disabled={!newChapterTitle.trim()}
              style={{ background: theme.primary, color: "#FBF9F4", border: "none", borderRadius: 10, padding: "9px 18px", fontSize: "0.85rem", cursor: "pointer", opacity: newChapterTitle.trim() ? 1 : 0.5 }}
            >
              شامل کریں
            </button>
          </div>
        </section>

        {/* Chapters list */}
        {sortedChapters.length === 0 && (
          <section style={sectionStyle}>
            <p style={{ fontSize: "0.85rem", color: theme.textMuted, textAlign: "center", margin: 0 }}>ابھی کوئی باب موجود نہیں۔</p>
          </section>
        )}

        {sortedChapters.map((chapter, idx) => {
          const isExpanded = expandedChapterId === chapter.id;
          const activeIdx = activeSorted.findIndex((c) => c.id === chapter.id);
          const chapterClauses = clausesForChapter(chapter.id);
          const clauseForm = clauseForms[chapter.id] || { title: "", text: "" };

          return (
            <section key={chapter.id} style={sectionStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <button onClick={() => moveChapter(chapter.id, "up")} disabled={idx === 0} style={{ ...iconBtnStyle(theme), opacity: idx === 0 ? 0.35 : 1 }} aria-label="اوپر منتقل کریں">
                    <ChevronUp size={15} />
                  </button>
                  <button onClick={() => moveChapter(chapter.id, "down")} disabled={idx === sortedChapters.length - 1} style={{ ...iconBtnStyle(theme), opacity: idx === sortedChapters.length - 1 ? 0.35 : 1 }} aria-label="نیچے منتقل کریں">
                    <ChevronDown size={15} />
                  </button>
                </div>

                <span style={{ fontSize: "0.72rem", color: theme.textMuted, flexShrink: 0 }}>
                  {chapter.status === "active" ? `باب ${activeIdx + 1}` : "آرکائیو"}
                </span>

                <input
                  style={{ ...inputStyle, flex: "1 1 200px" }}
                  value={chapter.title}
                  onChange={(e) => updateChapterTitle(chapter.id, e.target.value)}
                />

                <button
                  onClick={() => setChapterStatus(chapter.id, chapter.status === "active" ? "archived" : "active")}
                  style={{
                    border: "none",
                    borderRadius: 999,
                    padding: "6px 12px",
                    fontSize: "0.72rem",
                    cursor: "pointer",
                    background: chapter.status === "active" ? "rgba(91,107,98,0.14)" : "rgba(11,79,63,0.1)",
                    color: chapter.status === "active" ? theme.textMuted : theme.primary,
                  }}
                >
                  {chapter.status === "active" ? "آرکائیو کریں" : "بحال کریں"}
                </button>

                <button
                  onClick={() => deleteChapter(chapter.id)}
                  style={{ border: "none", borderRadius: 999, padding: "6px 12px", fontSize: "0.72rem", cursor: "pointer", background: "rgba(178,52,52,0.1)", color: "#B23434" }}
                >
                  حذف کریں
                </button>

                <button
                  onClick={() => setExpandedChapterId(isExpanded ? null : chapter.id)}
                  style={{ border: `1px solid ${theme.border}`, background: "#fff", color: theme.primary, borderRadius: 999, padding: "6px 12px", fontSize: "0.72rem", cursor: "pointer" }}
                >
                  {isExpanded ? "دفعات چھپائیں" : `دفعات (${chapterClauses.length})`}
                </button>
              </div>

              {isExpanded && (
                <div style={{ marginTop: 14, borderTop: `1px dashed ${theme.border}`, paddingTop: 14 }}>
                  {chapterClauses.length === 0 && (
                    <p style={{ fontSize: "0.8rem", color: theme.textMuted, margin: "0 0 10px" }}>اس باب میں ابھی کوئی دفعہ نہیں۔</p>
                  )}
                  <div style={{ display: "grid", gap: 10, marginBottom: 14 }}>
                    {chapterClauses.map((clause, clauseIdx) => (
                      <div key={clause.id} style={{ border: `1px solid ${theme.border}`, borderRadius: 10, padding: 10, background: "#FDFCF9" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
                          <div style={{ display: "flex", gap: 2 }}>
                            <button onClick={() => moveClause(chapter.id, clause.id, "up")} disabled={clauseIdx === 0} style={{ ...iconBtnStyle(theme), opacity: clauseIdx === 0 ? 0.35 : 1 }} aria-label="اوپر">
                              <ChevronUp size={13} />
                            </button>
                            <button onClick={() => moveClause(chapter.id, clause.id, "down")} disabled={clauseIdx === chapterClauses.length - 1} style={{ ...iconBtnStyle(theme), opacity: clauseIdx === chapterClauses.length - 1 ? 0.35 : 1 }} aria-label="نیچے">
                              <ChevronDown size={13} />
                            </button>
                          </div>
                          <span style={{ fontSize: "0.7rem", color: theme.textMuted }}>{clause.status === "active" ? `دفعہ ${clauseIdx + 1}` : "آرکائیو"}</span>
                          <div style={{ flex: 1 }} />
                          <button
                            onClick={() => setClauseStatus(clause.id, clause.status === "active" ? "archived" : "active")}
                            style={{
                              border: "none",
                              borderRadius: 999,
                              padding: "4px 10px",
                              fontSize: "0.68rem",
                              cursor: "pointer",
                              background: clause.status === "active" ? "rgba(91,107,98,0.14)" : "rgba(11,79,63,0.1)",
                              color: clause.status === "active" ? theme.textMuted : theme.primary,
                            }}
                          >
                            {clause.status === "active" ? "آرکائیو کریں" : "بحال کریں"}
                          </button>
                          <button
                            onClick={() => deleteClause(clause.id)}
                            style={{ border: "none", borderRadius: 999, padding: "4px 10px", fontSize: "0.68rem", cursor: "pointer", background: "rgba(178,52,52,0.1)", color: "#B23434" }}
                          >
                            حذف کریں
                          </button>
                        </div>
                        <input
                          style={{ ...inputStyle, marginBottom: 6, fontWeight: 600 }}
                          value={clause.title}
                          onChange={(e) => updateClause(clause.id, { title: e.target.value })}
                          placeholder="دفعہ کا عنوان"
                        />
                        <textarea
                          style={{ ...inputStyle, minHeight: 56, resize: "vertical" }}
                          value={clause.text}
                          onChange={(e) => updateClause(clause.id, { text: e.target.value })}
                          placeholder="دفعہ کا متن"
                        />
                      </div>
                    ))}
                  </div>

                  <div style={{ border: `1px dashed ${theme.border}`, borderRadius: 10, padding: 10 }}>
                    <label style={labelStyle}>نئی دفعہ شامل کریں</label>
                    <input
                      style={{ ...inputStyle, marginBottom: 6 }}
                      placeholder="دفعہ کا عنوان"
                      value={clauseForm.title}
                      onChange={(e) => setClauseForms((prev) => ({ ...prev, [chapter.id]: { ...clauseForm, title: e.target.value } }))}
                    />
                    <textarea
                      style={{ ...inputStyle, minHeight: 56, resize: "vertical", marginBottom: 8 }}
                      placeholder="دفعہ کا متن"
                      value={clauseForm.text}
                      onChange={(e) => setClauseForms((prev) => ({ ...prev, [chapter.id]: { ...clauseForm, text: e.target.value } }))}
                    />
                    <button
                      onClick={() => addClause(chapter.id)}
                      disabled={!clauseForm.title.trim()}
                      style={{ background: theme.primary, color: "#FBF9F4", border: "none", borderRadius: 9, padding: "7px 16px", fontSize: "0.8rem", cursor: "pointer", opacity: clauseForm.title.trim() ? 1 : 0.5 }}
                    >
                      دفعہ شامل کریں
                    </button>
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </main>

      <div style={{ position: "fixed", bottom: 0, insetInlineStart: 0, insetInlineEnd: 0, background: "#FFFFFF", borderTop: `1px solid ${theme.border}`, padding: "12px 16px", display: "flex", justifyContent: "center", gap: 12, boxShadow: "0 -6px 16px rgba(31,42,36,0.08)", zIndex: 25 }}>
        {savedFlash && (
          <span style={{ display: "flex", alignItems: "center", gap: 6, color: theme.primary, fontSize: "0.85rem", alignSelf: "center" }}>
            <CheckCircle2 size={16} /> تبدیلیاں کامیابی سے محفوظ ہوگئیں
          </span>
        )}
        <button
          onClick={handleSave}
          style={{ display: "flex", alignItems: "center", gap: 8, background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryDark} 100%)`, color: "#FBF9F4", border: "none", borderRadius: 12, padding: "12px 28px", fontSize: "0.95rem", fontFamily: "'Noto Naskh Arabic', serif", cursor: "pointer", boxShadow: "0 6px 16px rgba(11,79,63,0.28)" }}
        >
          <Save size={17} />
          تبدیلیاں محفوظ کریں
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   NOTICES — helpers
   ------------------------------------------------------------
   dastoorRefLabel() resolves a {chapterId, clauseId} reference
   against the LIVE Dastoor arrays at render time — the notice
   never stores a copy of the chapter/clause title or text, so
   the two datasets can never drift apart.
   ============================================================ */
function dastoorRefLabel(dastoorRef, chapters, clauses) {
  if (!dastoorRef || !dastoorRef.chapterId) return null;
  const activeChapters = chapters.filter((c) => c.status === "active").sort((a, b) => a.order - b.order);
  const chapterIdx = activeChapters.findIndex((c) => c.id === dastoorRef.chapterId);
  const chapter = activeChapters[chapterIdx];
  if (!chapter) return null;
  if (!dastoorRef.clauseId) return `باب ${chapterIdx + 1}: ${chapter.title}`;
  const chapterClauses = clauses
    .filter((cl) => cl.chapterId === chapter.id && cl.status === "active")
    .sort((a, b) => a.order - b.order);
  const clauseIdx = chapterClauses.findIndex((cl) => cl.id === dastoorRef.clauseId);
  const clause = chapterClauses[clauseIdx];
  if (!clause) return `باب ${chapterIdx + 1}: ${chapter.title}`;
  return `باب ${chapterIdx + 1}، دفعہ ${chapterIdx + 1}.${clauseIdx + 1}: ${clause.title}`;
}

function noticeTypeBadgeColor(type, theme) {
  const map = {
    "Warning": { bg: "rgba(184,134,43,0.16)", color: theme.accent },
    "Suspension": { bg: "rgba(178,52,52,0.12)", color: "#B23434" },
    "Fund Reminder": { bg: "rgba(11,79,63,0.1)", color: theme.primary },
  };
  return map[type] || { bg: "rgba(91,107,98,0.14)", color: theme.textMuted };
}

/* ============================================================
   PUBLIC NOTICES VIEW (Phase 1B — Notices)
   ------------------------------------------------------------
   Only shows notices where status === 'published' AND
   recipientMode === 'all' — anything targeted at specific
   members stays private, visible only from Notices Management.
   ============================================================ */
function NoticesPage({ theme, card, notices, dastoorChapters, dastoorClauses, onBack }) {
  const publicNotices = notices
    .filter((n) => n.status === "published" && n.recipientMode === "all")
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div dir="rtl" lang="ur" style={{ minHeight: "100vh", background: `linear-gradient(180deg, ${theme.background} 0%, ${theme.backgroundAlt} 100%)`, fontFamily: "'Noto Naskh Arabic', serif", color: theme.textStrong }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400..700&family=Noto+Naskh+Arabic:wght@400..700&display=swap'); .kw-heading { font-family: 'Noto Nastaliq Urdu', serif; }`}</style>

      <header style={{ background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryDark} 100%)`, color: "#FBF9F4", position: "sticky", top: 0, zIndex: 20, padding: "14px 18px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Bell size={20} />
            <h1 className="kw-heading" style={{ fontSize: "1.15rem", margin: 0 }}>{card.title}</h1>
          </div>
          <button
            onClick={onBack}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(251,249,244,0.14)", border: "1px solid rgba(251,249,244,0.35)", color: "#FBF9F4", borderRadius: 999, padding: "7px 14px", fontSize: "0.85rem", cursor: "pointer", fontFamily: "'Noto Naskh Arabic', serif" }}
          >
            <ArrowRight size={15} />
            ہوم پیج پر واپس جائیں
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 760, margin: "0 auto", padding: "28px 18px 60px" }}>
        {publicNotices.length === 0 && (
          <p style={{ textAlign: "center", color: theme.textMuted, fontSize: "0.9rem" }}>ابھی کوئی عمومی نوٹس شائع نہیں ہوا۔</p>
        )}
        <div style={{ display: "grid", gap: 14 }}>
          {publicNotices.map((notice) => {
            const badge = noticeTypeBadgeColor(notice.type, theme);
            const refLabel = dastoorRefLabel(notice.dastoorRef, dastoorChapters, dastoorClauses);
            return (
              <div key={notice.id} style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, padding: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                  <h2 className="kw-heading" style={{ fontSize: "1.05rem", color: theme.primary, margin: 0 }}>{notice.title}</h2>
                  <span style={{ background: badge.bg, color: badge.color, borderRadius: 999, padding: "3px 10px", fontSize: "0.7rem" }}>{notice.type}</span>
                </div>
                <div style={{ fontSize: "0.75rem", color: theme.textMuted, marginBottom: 8 }}>{notice.date}</div>
                <p style={{ fontSize: "0.88rem", color: theme.textStrong, lineHeight: 2, margin: 0 }}>{notice.text}</p>
                {refLabel && (
                  <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px dashed ${theme.border}`, fontSize: "0.75rem", color: theme.textMuted }}>
                    متعلقہ دستور حوالہ: {refLabel}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

/* ============================================================
   NOTICES MANAGEMENT (Phase 1B — Notices)
   ------------------------------------------------------------
   Same no-database, draft-then-Save pattern as the other admin
   screens. Notices are never deleted — Archive/Restore only.
   ============================================================ */
function emptyNoticeForm() {
  return {
    title: "",
    type: NOTICE_TYPES[0],
    date: new Date().toISOString().slice(0, 10),
    text: "",
    notes: "",
    recipientMode: "all",
    recipientMemberIds: [],
    dastoorChapterId: "",
    dastoorClauseId: "",
  };
}

function NoticesManagement({ theme, notices, members, dastoorChapters, dastoorClauses, onApply, onBack }) {
  const [draftNotices, setDraftNotices] = useState(notices);
  const [savedFlash, setSavedFlash] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all"); // all | draft | published | archived
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState(emptyNoticeForm());
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(emptyNoticeForm());

  const activeMembers = members.filter((m) => m.status === "active").sort((a, b) => a.name.localeCompare(b.name, "ur"));
  const activeChapters = dastoorChapters.filter((c) => c.status === "active").sort((a, b) => a.order - b.order);

  const visibleNotices = (statusFilter === "all" ? draftNotices : draftNotices.filter((n) => n.status === statusFilter))
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  function handleSave() {
    onApply(draftNotices);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2500);
  }

  function memberLabel(memberId) {
    const m = members.find((mm) => mm.id === memberId);
    return m ? `${m.name} (${m.memberId})` : "نامعلوم رکن";
  }

  function toggleFormMember(setF, memberId) {
    setF((prev) => {
      const has = prev.recipientMemberIds.includes(memberId);
      return { ...prev, recipientMemberIds: has ? prev.recipientMemberIds.filter((id) => id !== memberId) : [...prev.recipientMemberIds, memberId] };
    });
  }

  function addNotice() {
    if (!form.title.trim() || !form.text.trim()) return;
    const record = {
      id: `notice-${Date.now()}`,
      title: form.title.trim(),
      type: form.type,
      date: form.date,
      text: form.text.trim(),
      notes: form.notes.trim(),
      status: "draft",
      recipientMode: form.recipientMode,
      recipientMemberIds: form.recipientMode === "all" ? [] : form.recipientMemberIds,
      dastoorRef: form.dastoorChapterId ? { chapterId: form.dastoorChapterId, clauseId: form.dastoorClauseId || null } : null,
    };
    setDraftNotices((prev) => [record, ...prev]);
    setForm(emptyNoticeForm());
    setShowAddForm(false);
  }

  function startEdit(notice) {
    setEditingId(notice.id);
    setEditForm({
      title: notice.title,
      type: notice.type,
      date: notice.date,
      text: notice.text,
      notes: notice.notes,
      recipientMode: notice.recipientMode,
      recipientMemberIds: notice.recipientMemberIds || [],
      dastoorChapterId: notice.dastoorRef ? notice.dastoorRef.chapterId : "",
      dastoorClauseId: notice.dastoorRef ? notice.dastoorRef.clauseId || "" : "",
    });
  }

  function saveEdit(id) {
    setDraftNotices((prev) =>
      prev.map((n) =>
        n.id === id
          ? {
              ...n,
              title: editForm.title.trim() || n.title,
              type: editForm.type,
              date: editForm.date,
              text: editForm.text.trim() || n.text,
              notes: editForm.notes.trim(),
              recipientMode: editForm.recipientMode,
              recipientMemberIds: editForm.recipientMode === "all" ? [] : editForm.recipientMemberIds,
              dastoorRef: editForm.dastoorChapterId ? { chapterId: editForm.dastoorChapterId, clauseId: editForm.dastoorClauseId || null } : null,
            }
          : n
      )
    );
    setEditingId(null);
  }

  function setStatus(id, status) {
    setDraftNotices((prev) => prev.map((n) => (n.id === id ? { ...n, status } : n)));
  }

  const sectionStyle = {
    background: "#FFFFFF",
    border: `1px solid ${theme.border}`,
    borderRadius: 16,
    padding: "16px",
    marginBottom: 16,
    boxShadow: "0 1px 2px rgba(31,42,36,0.06)",
  };
  const labelStyle = { display: "block", fontSize: "0.78rem", color: theme.textMuted, marginBottom: 4 };
  const inputStyle = {
    width: "100%",
    boxSizing: "border-box",
    padding: "9px 10px",
    borderRadius: 9,
    border: `1px solid ${theme.border}`,
    fontFamily: "'Noto Naskh Arabic', serif",
    fontSize: "0.9rem",
    color: theme.textStrong,
    background: "#FDFCF9",
    marginBottom: 0,
  };

  function NoticeFormFields({ f, setF }) {
    const chapterClauses = f.dastoorChapterId ? dastoorClauses.filter((cl) => cl.chapterId === f.dastoorChapterId && cl.status === "active").sort((a, b) => a.order - b.order) : [];
    return (
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
          <div>
            <label style={labelStyle}>Title</label>
            <input style={inputStyle} value={f.title} onChange={(e) => setF((p) => ({ ...p, title: e.target.value }))} />
          </div>
          <div>
            <label style={labelStyle}>Notice Type</label>
            <select style={inputStyle} value={f.type} onChange={(e) => setF((p) => ({ ...p, type: e.target.value }))}>
              {NOTICE_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Date</label>
            <input type="date" style={{ ...inputStyle, direction: "ltr" }} value={f.date} onChange={(e) => setF((p) => ({ ...p, date: e.target.value }))} />
          </div>
        </div>

        <div>
          <label style={labelStyle}>مکمل اردو متن</label>
          <textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} value={f.text} onChange={(e) => setF((p) => ({ ...p, text: e.target.value }))} />
        </div>

        <div>
          <label style={labelStyle}>Notes</label>
          <input style={inputStyle} value={f.notes} onChange={(e) => setF((p) => ({ ...p, notes: e.target.value }))} />
        </div>

        <div style={{ borderTop: `1px dashed ${theme.border}`, paddingTop: 10 }}>
          <label style={labelStyle}>Recipients</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            {[
              ["all", "تمام Active Members"],
              ["selected", "منتخب Active Members"],
              ["single", "ایک Member"],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setF((p) => ({ ...p, recipientMode: key, recipientMemberIds: key === "single" ? p.recipientMemberIds.slice(0, 1) : p.recipientMemberIds }))}
                style={{
                  border: `1px solid ${theme.border}`,
                  borderRadius: 999,
                  padding: "6px 12px",
                  fontSize: "0.75rem",
                  cursor: "pointer",
                  background: f.recipientMode === key ? theme.primary : "#FDFCF9",
                  color: f.recipientMode === key ? "#FBF9F4" : theme.textStrong,
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {f.recipientMode !== "all" && (
            <div style={{ maxHeight: 160, overflowY: "auto", border: `1px solid ${theme.border}`, borderRadius: 10, padding: 8 }}>
              {activeMembers.length === 0 && <p style={{ fontSize: "0.78rem", color: theme.textMuted, margin: 0 }}>کوئی فعال رکن موجود نہیں۔</p>}
              {activeMembers.map((m) => {
                const checked = f.recipientMemberIds.includes(m.id);
                return (
                  <label key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.8rem", padding: "4px 2px", cursor: "pointer" }}>
                    <input
                      type={f.recipientMode === "single" ? "radio" : "checkbox"}
                      name={f.recipientMode === "single" ? "single-recipient" : undefined}
                      checked={checked}
                      onChange={() => {
                        if (f.recipientMode === "single") {
                          setF((p) => ({ ...p, recipientMemberIds: [m.id] }));
                        } else {
                          toggleFormMember(setF, m.id);
                        }
                      }}
                    />
                    {m.name} ({m.memberId})
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ borderTop: `1px dashed ${theme.border}`, paddingTop: 10 }}>
          <label style={labelStyle}>Dastoor Reference (اختیاری)</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select
              style={{ ...inputStyle, flex: "1 1 160px" }}
              value={f.dastoorChapterId}
              onChange={(e) => setF((p) => ({ ...p, dastoorChapterId: e.target.value, dastoorClauseId: "" }))}
            >
              <option value="">کوئی حوالہ نہیں</option>
              {activeChapters.map((c, idx) => (
                <option key={c.id} value={c.id}>باب {idx + 1}: {c.title}</option>
              ))}
            </select>
            {f.dastoorChapterId && (
              <select style={{ ...inputStyle, flex: "1 1 160px" }} value={f.dastoorClauseId} onChange={(e) => setF((p) => ({ ...p, dastoorClauseId: e.target.value }))}>
                <option value="">پورا باب</option>
                {chapterClauses.map((cl, idx) => (
                  <option key={cl.id} value={cl.id}>دفعہ {idx + 1}: {cl.title}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" lang="ur" style={{ minHeight: "100vh", background: `linear-gradient(180deg, ${theme.background} 0%, ${theme.backgroundAlt} 100%)`, fontFamily: "'Noto Naskh Arabic', serif", color: theme.textStrong }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400..700&family=Noto+Naskh+Arabic:wght@400..700&display=swap');`}</style>

      <header style={{ background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryDark} 100%)`, color: "#FBF9F4", position: "sticky", top: 0, zIndex: 20, padding: "14px 18px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Bell size={20} />
            <h1 style={{ fontFamily: "'Noto Nastaliq Urdu', serif", fontSize: "1.15rem", margin: 0 }}>نوٹسز کا انتظام</h1>
          </div>
          <button
            onClick={onBack}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(251,249,244,0.14)", border: "1px solid rgba(251,249,244,0.35)", color: "#FBF9F4", borderRadius: 999, padding: "7px 14px", fontSize: "0.85rem", cursor: "pointer", fontFamily: "'Noto Naskh Arabic', serif" }}
          >
            <ArrowRight size={15} />
            ایڈمن پینل
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 900, margin: "0 auto", padding: "20px 16px 120px" }}>
        {/* Filter + Add */}
        <section style={sectionStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: showAddForm ? 14 : 0 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[
                ["all", "سب"],
                ["draft", "Draft"],
                ["published", "Published"],
                ["archived", "Archived"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setStatusFilter(key)}
                  style={{
                    border: `1px solid ${theme.border}`,
                    borderRadius: 999,
                    padding: "6px 12px",
                    fontSize: "0.78rem",
                    cursor: "pointer",
                    background: statusFilter === key ? theme.primary : "#FDFCF9",
                    color: statusFilter === key ? "#FBF9F4" : theme.textStrong,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowAddForm((v) => !v)}
              style={{ display: "flex", alignItems: "center", gap: 6, background: theme.primary, color: "#FBF9F4", border: "none", borderRadius: 999, padding: "8px 16px", fontSize: "0.82rem", cursor: "pointer" }}
            >
              {showAddForm ? "بند کریں" : "+ نیا Notice شامل کریں"}
            </button>
          </div>

          {showAddForm && (
            <div style={{ borderTop: `1px dashed ${theme.border}`, paddingTop: 14 }}>
              {NoticeFormFields({ f: form, setF: setForm })}
              <button
                onClick={addNotice}
                disabled={!form.title.trim() || !form.text.trim()}
                style={{ marginTop: 12, background: theme.primary, color: "#FBF9F4", border: "none", borderRadius: 10, padding: "9px 18px", fontSize: "0.85rem", cursor: "pointer", opacity: form.title.trim() && form.text.trim() ? 1 : 0.5 }}
              >
                Draft کے طور پر محفوظ کریں
              </button>
            </div>
          )}
        </section>

        {/* Notices list */}
        <section style={sectionStyle}>
          <h2 style={{ fontFamily: "'Noto Nastaliq Urdu', serif", fontSize: "1.05rem", color: theme.primary, margin: "0 0 12px" }}>
            Notice History
          </h2>
          <div style={{ display: "grid", gap: 10 }}>
            {visibleNotices.length === 0 && (
              <p style={{ fontSize: "0.85rem", color: theme.textMuted, textAlign: "center", margin: 0 }}>اس فہرست میں کوئی Notice موجود نہیں۔</p>
            )}
            {visibleNotices.map((notice) => {
              const badge = noticeTypeBadgeColor(notice.type, theme);
              const refLabel = dastoorRefLabel(notice.dastoorRef, dastoorChapters, dastoorClauses);
              const recipientSummary =
                notice.recipientMode === "all"
                  ? "تمام Active Members"
                  : notice.recipientMode === "single"
                  ? memberLabel(notice.recipientMemberIds[0])
                  : `${notice.recipientMemberIds.length} منتخب ممبران`;

              return (
                <div key={notice.id} style={{ border: `1px solid ${theme.border}`, borderRadius: 12, padding: 12, background: "#FDFCF9" }}>
                  {editingId === notice.id ? (
                    <div>
                      {NoticeFormFields({ f: editForm, setF: setEditForm })}
                      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                        <button onClick={() => saveEdit(notice.id)} style={{ background: theme.primary, color: "#FBF9F4", border: "none", borderRadius: 9, padding: "7px 14px", fontSize: "0.8rem", cursor: "pointer" }}>
                          محفوظ کریں
                        </button>
                        <button onClick={() => setEditingId(null)} style={{ background: "#fff", border: `1px solid ${theme.border}`, color: theme.textMuted, borderRadius: 9, padding: "7px 14px", fontSize: "0.8rem", cursor: "pointer" }}>
                          منسوخ
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                        <strong>{notice.title}</strong>
                        <span style={{ background: badge.bg, color: badge.color, borderRadius: 999, padding: "3px 10px", fontSize: "0.7rem" }}>{notice.type}</span>
                        <span
                          style={{
                            borderRadius: 999,
                            padding: "3px 10px",
                            fontSize: "0.7rem",
                            background: notice.status === "published" ? "rgba(11,79,63,0.1)" : notice.status === "archived" ? "rgba(91,107,98,0.14)" : "rgba(184,134,43,0.14)",
                            color: notice.status === "published" ? theme.primary : notice.status === "archived" ? theme.textMuted : theme.accent,
                          }}
                        >
                          {notice.status === "published" ? "Published" : notice.status === "archived" ? "Archived" : "Draft"}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.75rem", color: theme.textMuted, marginBottom: 6 }}>
                        {notice.date} · {recipientSummary}
                        {refLabel ? ` · ${refLabel}` : ""}
                      </div>
                      <p style={{ fontSize: "0.82rem", color: theme.textStrong, lineHeight: 1.9, margin: "0 0 8px" }}>{notice.text}</p>
                      {notice.notes && <div style={{ fontSize: "0.72rem", color: theme.textMuted, marginBottom: 8 }}>نوٹس: {notice.notes}</div>}

                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button onClick={() => startEdit(notice)} style={{ border: `1px solid ${theme.border}`, background: "#fff", color: theme.primary, borderRadius: 999, padding: "5px 11px", fontSize: "0.72rem", cursor: "pointer" }}>
                          ترمیم
                        </button>
                        {notice.status === "draft" && (
                          <button onClick={() => setStatus(notice.id, "published")} style={{ border: "none", background: "rgba(11,79,63,0.1)", color: theme.primary, borderRadius: 999, padding: "5px 11px", fontSize: "0.72rem", cursor: "pointer" }}>
                            شائع کریں (Publish)
                          </button>
                        )}
                        {notice.status === "published" && (
                          <button onClick={() => setStatus(notice.id, "archived")} style={{ border: "none", background: "rgba(91,107,98,0.14)", color: theme.textMuted, borderRadius: 999, padding: "5px 11px", fontSize: "0.72rem", cursor: "pointer" }}>
                            آرکائیو کریں (Archive)
                          </button>
                        )}
                        {notice.status === "archived" && (
                          <button onClick={() => setStatus(notice.id, "published")} style={{ border: "none", background: "rgba(11,79,63,0.1)", color: theme.primary, borderRadius: 999, padding: "5px 11px", fontSize: "0.72rem", cursor: "pointer" }}>
                            بحال کریں (Restore)
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <div style={{ position: "fixed", bottom: 0, insetInlineStart: 0, insetInlineEnd: 0, background: "#FFFFFF", borderTop: `1px solid ${theme.border}`, padding: "12px 16px", display: "flex", justifyContent: "center", gap: 12, boxShadow: "0 -6px 16px rgba(31,42,36,0.08)", zIndex: 25 }}>
        {savedFlash && (
          <span style={{ display: "flex", alignItems: "center", gap: 6, color: theme.primary, fontSize: "0.85rem", alignSelf: "center" }}>
            <CheckCircle2 size={16} /> تبدیلیاں کامیابی سے محفوظ ہوگئیں
          </span>
        )}
        <button
          onClick={handleSave}
          style={{ display: "flex", alignItems: "center", gap: 8, background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryDark} 100%)`, color: "#FBF9F4", border: "none", borderRadius: 12, padding: "12px 28px", fontSize: "0.95rem", fontFamily: "'Noto Naskh Arabic', serif", cursor: "pointer", boxShadow: "0 6px 16px rgba(11,79,63,0.28)" }}
        >
          <Save size={17} />
          تبدیلیاں محفوظ کریں
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   PUBLIC ACTIVITIES VIEW (Phase 1B — Activities / سرگرمیاں)
   ------------------------------------------------------------
   Only shows status === 'published' activities, newest date
   first. imageUrls is a plain array of strings — rendered as a
   simple thumbnail grid; broken/empty URLs are just skipped by
   the browser, no upload backend needed yet.
   ============================================================ */
function ActivitiesPage({ theme, card, activities, onBack }) {
  const publicActivities = activities
    .filter((a) => a.status === "published")
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div dir="rtl" lang="ur" style={{ minHeight: "100vh", background: `linear-gradient(180deg, ${theme.background} 0%, ${theme.backgroundAlt} 100%)`, fontFamily: "'Noto Naskh Arabic', serif", color: theme.textStrong }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400..700&family=Noto+Naskh+Arabic:wght@400..700&display=swap'); .kw-heading { font-family: 'Noto Nastaliq Urdu', serif; }`}</style>

      <header style={{ background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryDark} 100%)`, color: "#FBF9F4", position: "sticky", top: 0, zIndex: 20, padding: "14px 18px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Activity size={20} />
            <h1 className="kw-heading" style={{ fontSize: "1.15rem", margin: 0 }}>{card.title}</h1>
          </div>
          <button
            onClick={onBack}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(251,249,244,0.14)", border: "1px solid rgba(251,249,244,0.35)", color: "#FBF9F4", borderRadius: 999, padding: "7px 14px", fontSize: "0.85rem", cursor: "pointer", fontFamily: "'Noto Naskh Arabic', serif" }}
          >
            <ArrowRight size={15} />
            ہوم پیج پر واپس جائیں
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 760, margin: "0 auto", padding: "28px 18px 60px" }}>
        {publicActivities.length === 0 && (
          <p style={{ textAlign: "center", color: theme.textMuted, fontSize: "0.9rem" }}>ابھی کوئی سرگرمی شائع نہیں ہوئی۔</p>
        )}
        <div style={{ display: "grid", gap: 16 }}>
          {publicActivities.map((activity) => (
            <div key={activity.id} style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, padding: "16px" }}>
              <h2 className="kw-heading" style={{ fontSize: "1.05rem", color: theme.primary, margin: "0 0 4px" }}>{activity.title}</h2>
              <div style={{ fontSize: "0.75rem", color: theme.textMuted, marginBottom: 10 }}>{activity.date}</div>
              {activity.imageUrls && activity.imageUrls.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))", gap: 8, marginBottom: 10 }}>
                  {activity.imageUrls.filter(Boolean).map((url, idx) => (
                    <img
                      key={idx}
                      src={url}
                      alt=""
                      style={{ width: "100%", height: 90, objectFit: "cover", borderRadius: 10, border: `1px solid ${theme.border}` }}
                      onError={(e) => { e.currentTarget.style.display = "none"; }}
                    />
                  ))}
                </div>
              )}
              <p style={{ fontSize: "0.88rem", color: theme.textStrong, lineHeight: 2, margin: 0 }}>{activity.description}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

/* ============================================================
   ACTIVITIES MANAGEMENT (Phase 1B — Activities)
   ------------------------------------------------------------
   Same no-database, draft-then-Save pattern as Notices/Members/
   Funds/Expenses. Activities are never deleted — Archive/Restore
   only. imageUrls is edited as a dynamic list of URL inputs.
   ============================================================ */
function emptyActivityForm() {
  return {
    title: "",
    date: new Date().toISOString().slice(0, 10),
    description: "",
    imageUrls: [""],
  };
}

function ActivitiesManagement({ theme, activities, onApply, onBack }) {
  const [draftActivities, setDraftActivities] = useState(activities);
  const [savedFlash, setSavedFlash] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all"); // all | draft | published | archived
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState(emptyActivityForm());
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(emptyActivityForm());

  const visibleActivities = (statusFilter === "all" ? draftActivities : draftActivities.filter((a) => a.status === statusFilter))
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  function handleSave() {
    onApply(draftActivities);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2500);
  }

  function addActivity() {
    if (!form.title.trim() || !form.description.trim()) return;
    const record = {
      id: `activity-${Date.now()}`,
      title: form.title.trim(),
      date: form.date,
      description: form.description.trim(),
      imageUrls: form.imageUrls.map((u) => u.trim()).filter(Boolean),
      status: "draft",
    };
    setDraftActivities((prev) => [record, ...prev]);
    setForm(emptyActivityForm());
    setShowAddForm(false);
  }

  function startEdit(activity) {
    setEditingId(activity.id);
    setEditForm({
      title: activity.title,
      date: activity.date,
      description: activity.description,
      imageUrls: activity.imageUrls && activity.imageUrls.length ? activity.imageUrls : [""],
    });
  }

  function saveEdit(id) {
    setDraftActivities((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              title: editForm.title.trim() || a.title,
              date: editForm.date,
              description: editForm.description.trim() || a.description,
              imageUrls: editForm.imageUrls.map((u) => u.trim()).filter(Boolean),
            }
          : a
      )
    );
    setEditingId(null);
  }

  function setStatus(id, status) {
    setDraftActivities((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
  }

  const sectionStyle = {
    background: "#FFFFFF",
    border: `1px solid ${theme.border}`,
    borderRadius: 16,
    padding: "16px",
    marginBottom: 16,
    boxShadow: "0 1px 2px rgba(31,42,36,0.06)",
  };
  const labelStyle = { display: "block", fontSize: "0.78rem", color: theme.textMuted, marginBottom: 4 };
  const inputStyle = {
    width: "100%",
    boxSizing: "border-box",
    padding: "9px 10px",
    borderRadius: 9,
    border: `1px solid ${theme.border}`,
    fontFamily: "'Noto Naskh Arabic', serif",
    fontSize: "0.9rem",
    color: theme.textStrong,
    background: "#FDFCF9",
    marginBottom: 0,
  };

  function ActivityFormFields({ f, setF }) {
    function updateImageUrl(idx, value) {
      setF((p) => {
        const next = [...p.imageUrls];
        next[idx] = value;
        return { ...p, imageUrls: next };
      });
    }
    function addImageField() {
      setF((p) => ({ ...p, imageUrls: [...p.imageUrls, ""] }));
    }
    function removeImageField(idx) {
      setF((p) => ({ ...p, imageUrls: p.imageUrls.filter((_, i) => i !== idx) }));
    }

    return (
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
          <div>
            <label style={labelStyle}>Activity Title</label>
            <input style={inputStyle} value={f.title} onChange={(e) => setF((p) => ({ ...p, title: e.target.value }))} />
          </div>
          <div>
            <label style={labelStyle}>Date</label>
            <input type="date" style={{ ...inputStyle, direction: "ltr" }} value={f.date} onChange={(e) => setF((p) => ({ ...p, date: e.target.value }))} />
          </div>
        </div>

        <div>
          <label style={labelStyle}>مکمل اردو تفصیل (Description)</label>
          <textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} value={f.description} onChange={(e) => setF((p) => ({ ...p, description: e.target.value }))} />
        </div>

        <div>
          <label style={labelStyle}>Image URLs</label>
          <div style={{ display: "grid", gap: 6 }}>
            {f.imageUrls.map((url, idx) => (
              <div key={idx} style={{ display: "flex", gap: 6 }}>
                <input
                  style={{ ...inputStyle, direction: "ltr", textAlign: "left", flex: 1 }}
                  placeholder="https://..."
                  value={url}
                  onChange={(e) => updateImageUrl(idx, e.target.value)}
                />
                {f.imageUrls.length > 1 && (
                  <button onClick={() => removeImageField(idx)} style={{ border: `1px solid ${theme.border}`, background: "#fff", color: theme.textMuted, borderRadius: 9, padding: "0 10px", cursor: "pointer" }}>
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          <button onClick={addImageField} style={{ marginTop: 6, border: `1px solid ${theme.border}`, background: "#fff", color: theme.primary, borderRadius: 999, padding: "5px 12px", fontSize: "0.75rem", cursor: "pointer" }}>
            + مزید Image URL شامل کریں
          </button>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" lang="ur" style={{ minHeight: "100vh", background: `linear-gradient(180deg, ${theme.background} 0%, ${theme.backgroundAlt} 100%)`, fontFamily: "'Noto Naskh Arabic', serif", color: theme.textStrong }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400..700&family=Noto+Naskh+Arabic:wght@400..700&display=swap');`}</style>

      <header style={{ background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryDark} 100%)`, color: "#FBF9F4", position: "sticky", top: 0, zIndex: 20, padding: "14px 18px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Activity size={20} />
            <h1 style={{ fontFamily: "'Noto Nastaliq Urdu', serif", fontSize: "1.15rem", margin: 0 }}>سرگرمیوں کا انتظام</h1>
          </div>
          <button
            onClick={onBack}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(251,249,244,0.14)", border: "1px solid rgba(251,249,244,0.35)", color: "#FBF9F4", borderRadius: 999, padding: "7px 14px", fontSize: "0.85rem", cursor: "pointer", fontFamily: "'Noto Naskh Arabic', serif" }}
          >
            <ArrowRight size={15} />
            ایڈمن پینل
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 900, margin: "0 auto", padding: "20px 16px 120px" }}>
        {/* Filter + Add */}
        <section style={sectionStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: showAddForm ? 14 : 0 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[
                ["all", "سب"],
                ["draft", "Draft"],
                ["published", "Published"],
                ["archived", "Archived"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setStatusFilter(key)}
                  style={{
                    border: `1px solid ${theme.border}`,
                    borderRadius: 999,
                    padding: "6px 12px",
                    fontSize: "0.78rem",
                    cursor: "pointer",
                    background: statusFilter === key ? theme.primary : "#FDFCF9",
                    color: statusFilter === key ? "#FBF9F4" : theme.textStrong,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowAddForm((v) => !v)}
              style={{ display: "flex", alignItems: "center", gap: 6, background: theme.primary, color: "#FBF9F4", border: "none", borderRadius: 999, padding: "8px 16px", fontSize: "0.82rem", cursor: "pointer" }}
            >
              {showAddForm ? "بند کریں" : "+ نئی سرگرمی شامل کریں"}
            </button>
          </div>

          {showAddForm && (
            <div style={{ borderTop: `1px dashed ${theme.border}`, paddingTop: 14 }}>
              {ActivityFormFields({ f: form, setF: setForm })}
              <button
                onClick={addActivity}
                disabled={!form.title.trim() || !form.description.trim()}
                style={{ marginTop: 12, background: theme.primary, color: "#FBF9F4", border: "none", borderRadius: 10, padding: "9px 18px", fontSize: "0.85rem", cursor: "pointer", opacity: form.title.trim() && form.description.trim() ? 1 : 0.5 }}
              >
                Draft کے طور پر محفوظ کریں
              </button>
            </div>
          )}
        </section>

        {/* Activities list */}
        <section style={sectionStyle}>
          <h2 style={{ fontFamily: "'Noto Nastaliq Urdu', serif", fontSize: "1.05rem", color: theme.primary, margin: "0 0 12px" }}>
            Activities History
          </h2>
          <div style={{ display: "grid", gap: 10 }}>
            {visibleActivities.length === 0 && (
              <p style={{ fontSize: "0.85rem", color: theme.textMuted, textAlign: "center", margin: 0 }}>اس فہرست میں کوئی سرگرمی موجود نہیں۔</p>
            )}
            {visibleActivities.map((activity) => (
              <div key={activity.id} style={{ border: `1px solid ${theme.border}`, borderRadius: 12, padding: 12, background: "#FDFCF9" }}>
                {editingId === activity.id ? (
                  <div>
                    {ActivityFormFields({ f: editForm, setF: setEditForm })}
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <button onClick={() => saveEdit(activity.id)} style={{ background: theme.primary, color: "#FBF9F4", border: "none", borderRadius: 9, padding: "7px 14px", fontSize: "0.8rem", cursor: "pointer" }}>
                        محفوظ کریں
                      </button>
                      <button onClick={() => setEditingId(null)} style={{ background: "#fff", border: `1px solid ${theme.border}`, color: theme.textMuted, borderRadius: 9, padding: "7px 14px", fontSize: "0.8rem", cursor: "pointer" }}>
                        منسوخ
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                      <strong>{activity.title}</strong>
                      <span
                        style={{
                          borderRadius: 999,
                          padding: "3px 10px",
                          fontSize: "0.7rem",
                          background: activity.status === "published" ? "rgba(11,79,63,0.1)" : activity.status === "archived" ? "rgba(91,107,98,0.14)" : "rgba(184,134,43,0.14)",
                          color: activity.status === "published" ? theme.primary : activity.status === "archived" ? theme.textMuted : theme.accent,
                        }}
                      >
                        {activity.status === "published" ? "Published" : activity.status === "archived" ? "Archived" : "Draft"}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.75rem", color: theme.textMuted, marginBottom: 6 }}>
                      {activity.date}
                      {activity.imageUrls && activity.imageUrls.length > 0 ? ` · ${activity.imageUrls.length} تصویر/تصاویر` : ""}
                    </div>
                    <p style={{ fontSize: "0.82rem", color: theme.textStrong, lineHeight: 1.9, margin: "0 0 8px" }}>{activity.description}</p>

                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button onClick={() => startEdit(activity)} style={{ border: `1px solid ${theme.border}`, background: "#fff", color: theme.primary, borderRadius: 999, padding: "5px 11px", fontSize: "0.72rem", cursor: "pointer" }}>
                        ترمیم
                      </button>
                      {activity.status === "draft" && (
                        <button onClick={() => setStatus(activity.id, "published")} style={{ border: "none", background: "rgba(11,79,63,0.1)", color: theme.primary, borderRadius: 999, padding: "5px 11px", fontSize: "0.72rem", cursor: "pointer" }}>
                          شائع کریں (Publish)
                        </button>
                      )}
                      {activity.status === "published" && (
                        <button onClick={() => setStatus(activity.id, "archived")} style={{ border: "none", background: "rgba(91,107,98,0.14)", color: theme.textMuted, borderRadius: 999, padding: "5px 11px", fontSize: "0.72rem", cursor: "pointer" }}>
                          آرکائیو کریں (Archive)
                        </button>
                      )}
                      {activity.status === "archived" && (
                        <button onClick={() => setStatus(activity.id, "published")} style={{ border: "none", background: "rgba(11,79,63,0.1)", color: theme.primary, borderRadius: 999, padding: "5px 11px", fontSize: "0.72rem", cursor: "pointer" }}>
                          بحال کریں (Restore)
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>

      <div style={{ position: "fixed", bottom: 0, insetInlineStart: 0, insetInlineEnd: 0, background: "#FFFFFF", borderTop: `1px solid ${theme.border}`, padding: "12px 16px", display: "flex", justifyContent: "center", gap: 12, boxShadow: "0 -6px 16px rgba(31,42,36,0.08)", zIndex: 25 }}>
        {savedFlash && (
          <span style={{ display: "flex", alignItems: "center", gap: 6, color: theme.primary, fontSize: "0.85rem", alignSelf: "center" }}>
            <CheckCircle2 size={16} /> تبدیلیاں کامیابی سے محفوظ ہوگئیں
          </span>
        )}
        <button
          onClick={handleSave}
          style={{ display: "flex", alignItems: "center", gap: 8, background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryDark} 100%)`, color: "#FBF9F4", border: "none", borderRadius: 12, padding: "12px 28px", fontSize: "0.95rem", fontFamily: "'Noto Naskh Arabic', serif", cursor: "pointer", boxShadow: "0 6px 16px rgba(11,79,63,0.28)" }}
        >
          <Save size={17} />
          تبدیلیاں محفوظ کریں
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   ENCOURAGEMENT — helper: live financial total for a member
   ------------------------------------------------------------
   Sums the ALREADY-COMPUTED paidFund/donation fields straight
   out of the existing `payments` array (FundsManagement's data).
   No new calculation — computeFundBreakdown is not re-invoked.
   ============================================================ */
function memberFinancialTotal(memberId, payments) {
  return payments
    .filter((p) => p.memberId === memberId)
    .reduce((acc, p) => ({ fund: acc.fund + p.paidFund, donation: acc.donation + p.donation }), { fund: 0, donation: 0 });
}

/* ============================================================
   PUBLIC ENCOURAGEMENT VIEW (Phase 1B — حوصلہ افزائی)
   ------------------------------------------------------------
   Shows published achievements sorted by `order`. Member name
   and photo are looked up live from `members` via memberId —
   never copied into the achievement record.
   ============================================================ */
function EncouragementPage({ theme, card, achievements, members, payments, currency, onBack }) {
  const publicAchievements = achievements
    .filter((a) => a.status === "published")
    .slice()
    .sort((a, b) => a.order - b.order);

  function memberFor(memberId) {
    return members.find((m) => m.id === memberId);
  }

  return (
    <div dir="rtl" lang="ur" style={{ minHeight: "100vh", background: `linear-gradient(180deg, ${theme.background} 0%, ${theme.backgroundAlt} 100%)`, fontFamily: "'Noto Naskh Arabic', serif", color: theme.textStrong }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400..700&family=Noto+Naskh+Arabic:wght@400..700&display=swap'); .kw-heading { font-family: 'Noto Nastaliq Urdu', serif; }`}</style>

      <header style={{ background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryDark} 100%)`, color: "#FBF9F4", position: "sticky", top: 0, zIndex: 20, padding: "14px 18px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Award size={20} />
            <h1 className="kw-heading" style={{ fontSize: "1.15rem", margin: 0 }}>{card.title}</h1>
          </div>
          <button
            onClick={onBack}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(251,249,244,0.14)", border: "1px solid rgba(251,249,244,0.35)", color: "#FBF9F4", borderRadius: 999, padding: "7px 14px", fontSize: "0.85rem", cursor: "pointer", fontFamily: "'Noto Naskh Arabic', serif" }}
          >
            <ArrowRight size={15} />
            ہوم پیج پر واپس جائیں
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 760, margin: "0 auto", padding: "28px 18px 60px" }}>
        {publicAchievements.length === 0 && (
          <p style={{ textAlign: "center", color: theme.textMuted, fontSize: "0.9rem" }}>ابھی کوئی حوصلہ افزائی شائع نہیں ہوئی۔</p>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          {publicAchievements.map((a) => {
            const member = memberFor(a.memberId);
            const totals = a.showFinancialContribution ? memberFinancialTotal(a.memberId, payments) : null;
            return (
              <div key={a.id} style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, padding: "16px", textAlign: "center" }}>
                <div
                  style={{
                    width: 56, height: 56, borderRadius: "50%", margin: "0 auto 10px", overflow: "hidden",
                    background: "rgba(11,79,63,0.08)", display: "flex", alignItems: "center", justifyContent: "center",
                    color: theme.primary, fontWeight: 700, fontSize: "1.1rem",
                  }}
                >
                  {member && member.photo ? (
                    <img src={member.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { e.currentTarget.style.display = "none"; }} />
                  ) : (
                    (member ? member.name.trim().charAt(0) : "؟")
                  )}
                </div>
                <div style={{ fontWeight: 700, marginBottom: 2 }}>{member ? member.name : "نامعلوم رکن"}</div>
                <span style={{ display: "inline-block", background: "rgba(184,134,43,0.14)", color: theme.accent, borderRadius: 999, padding: "3px 10px", fontSize: "0.7rem", marginBottom: 8 }}>{a.type}</span>
                <h3 className="kw-heading" style={{ fontSize: "1rem", color: theme.primary, margin: "0 0 4px" }}>{a.title}</h3>
                <p style={{ fontSize: "0.82rem", color: theme.textMuted, lineHeight: 1.9, margin: "0 0 6px" }}>{a.description}</p>
                <div style={{ fontSize: "0.74rem", color: theme.textMuted }}>{a.period}</div>
                {totals && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${theme.border}`, fontSize: "0.74rem", color: theme.textMuted }}>
                    کل حصہ: <strong style={{ color: theme.primary }}>{totals.fund + totals.donation} {currency}</strong>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

/* ============================================================
   ACHIEVEMENTS MANAGEMENT (Phase 1B — Encouragement)
   ------------------------------------------------------------
   Same no-database, draft-then-Save pattern as the other admin
   screens. Achievements are never deleted — Archive/Restore
   only. Reordering swaps `order` values, same pattern used for
   Cards and Dastoor.
   ============================================================ */
function emptyAchievementForm() {
  return {
    memberId: "",
    title: "",
    description: "",
    period: "",
    type: ACHIEVEMENT_TYPES[0],
    showFinancialContribution: false,
  };
}

function AchievementsManagement({ theme, achievements, members, payments, onApply, onBack }) {
  const [draftAchievements, setDraftAchievements] = useState(achievements);
  const [savedFlash, setSavedFlash] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all"); // all | draft | published | archived
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState(emptyAchievementForm());
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(emptyAchievementForm());

  const activeMembers = members.filter((m) => m.status === "active").sort((a, b) => a.name.localeCompare(b.name, "ur"));
  const sortedAll = [...draftAchievements].sort((a, b) => a.order - b.order);
  const visibleAchievements = statusFilter === "all" ? sortedAll : sortedAll.filter((a) => a.status === statusFilter);

  function memberLabel(memberId) {
    const m = members.find((mm) => mm.id === memberId);
    return m ? `${m.name} (${m.memberId})` : "نامعلوم رکن";
  }

  function handleSave() {
    onApply(draftAchievements);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2500);
  }

  function addAchievement() {
    if (!form.memberId || !form.title.trim()) return;
    const maxOrder = draftAchievements.reduce((m, a) => Math.max(m, a.order), 0);
    const record = {
      id: `achievement-${Date.now()}`,
      memberId: form.memberId,
      title: form.title.trim(),
      description: form.description.trim(),
      period: form.period.trim(),
      type: form.type,
      order: maxOrder + 1,
      showFinancialContribution: form.showFinancialContribution,
      status: "draft",
    };
    setDraftAchievements((prev) => [...prev, record]);
    setForm(emptyAchievementForm());
    setShowAddForm(false);
  }

  function startEdit(a) {
    setEditingId(a.id);
    setEditForm({
      memberId: a.memberId,
      title: a.title,
      description: a.description,
      period: a.period,
      type: a.type,
      showFinancialContribution: a.showFinancialContribution,
    });
  }

  function saveEdit(id) {
    setDraftAchievements((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              memberId: editForm.memberId || a.memberId,
              title: editForm.title.trim() || a.title,
              description: editForm.description.trim(),
              period: editForm.period.trim(),
              type: editForm.type,
              showFinancialContribution: editForm.showFinancialContribution,
            }
          : a
      )
    );
    setEditingId(null);
  }

  function setStatus(id, status) {
    setDraftAchievements((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
  }

  function moveAchievement(id, direction) {
    setDraftAchievements((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((a) => a.id === id);
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= sorted.length) return prev;
      const a = sorted[idx];
      const b = sorted[swapIdx];
      return prev.map((item) => {
        if (item.id === a.id) return { ...item, order: b.order };
        if (item.id === b.id) return { ...item, order: a.order };
        return item;
      });
    });
  }

  const sectionStyle = {
    background: "#FFFFFF",
    border: `1px solid ${theme.border}`,
    borderRadius: 16,
    padding: "16px",
    marginBottom: 16,
    boxShadow: "0 1px 2px rgba(31,42,36,0.06)",
  };
  const labelStyle = { display: "block", fontSize: "0.78rem", color: theme.textMuted, marginBottom: 4 };
  const inputStyle = {
    width: "100%",
    boxSizing: "border-box",
    padding: "9px 10px",
    borderRadius: 9,
    border: `1px solid ${theme.border}`,
    fontFamily: "'Noto Naskh Arabic', serif",
    fontSize: "0.9rem",
    color: theme.textStrong,
    background: "#FDFCF9",
    marginBottom: 0,
  };

  function AchievementFormFields({ f, setF }) {
    const totals = f.memberId ? memberFinancialTotal(f.memberId, payments) : null;
    return (
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
          <div>
            <label style={labelStyle}>رکن (Member)</label>
            <select style={inputStyle} value={f.memberId} onChange={(e) => setF((p) => ({ ...p, memberId: e.target.value }))}>
              <option value="">منتخب کریں</option>
              {activeMembers.map((m) => (
                <option key={m.id} value={m.id}>{m.name} ({m.memberId})</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Achievement Type</label>
            <select style={inputStyle} value={f.type} onChange={(e) => setF((p) => ({ ...p, type: e.target.value }))}>
              {ACHIEVEMENT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Date/Period</label>
            <input style={inputStyle} placeholder="مثلاً: جنوری 2026" value={f.period} onChange={(e) => setF((p) => ({ ...p, period: e.target.value }))} />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Title</label>
          <input style={inputStyle} value={f.title} onChange={(e) => setF((p) => ({ ...p, title: e.target.value }))} />
        </div>

        <div>
          <label style={labelStyle}>Description</label>
          <textarea style={{ ...inputStyle, minHeight: 64, resize: "vertical" }} value={f.description} onChange={(e) => setF((p) => ({ ...p, description: e.target.value }))} />
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.8rem", cursor: "pointer" }}>
          <input type="checkbox" checked={f.showFinancialContribution} onChange={(e) => setF((p) => ({ ...p, showFinancialContribution: e.target.checked }))} />
          اس رکن کا مالی حصہ (Fund + Donations) بھی Public صفحے پر دکھائیں
        </label>

        {f.showFinancialContribution && totals && (
          <div style={{ background: "rgba(11,79,63,0.06)", borderRadius: 10, padding: "8px 12px", fontSize: "0.78rem" }}>
            موجودہ ریکارڈ سے: Paid Fund <strong style={{ color: theme.primary }}>{totals.fund}</strong> + Donation <strong style={{ color: theme.primary }}>{totals.donation}</strong> = <strong style={{ color: theme.primary }}>{totals.fund + totals.donation}</strong>
          </div>
        )}
      </div>
    );
  }

  return (
    <div dir="rtl" lang="ur" style={{ minHeight: "100vh", background: `linear-gradient(180deg, ${theme.background} 0%, ${theme.backgroundAlt} 100%)`, fontFamily: "'Noto Naskh Arabic', serif", color: theme.textStrong }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400..700&family=Noto+Naskh+Arabic:wght@400..700&display=swap');`}</style>

      <header style={{ background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryDark} 100%)`, color: "#FBF9F4", position: "sticky", top: 0, zIndex: 20, padding: "14px 18px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Award size={20} />
            <h1 style={{ fontFamily: "'Noto Nastaliq Urdu', serif", fontSize: "1.15rem", margin: 0 }}>حوصلہ افزائی کا انتظام</h1>
          </div>
          <button
            onClick={onBack}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(251,249,244,0.14)", border: "1px solid rgba(251,249,244,0.35)", color: "#FBF9F4", borderRadius: 999, padding: "7px 14px", fontSize: "0.85rem", cursor: "pointer", fontFamily: "'Noto Naskh Arabic', serif" }}
          >
            <ArrowRight size={15} />
            ایڈمن پینل
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 900, margin: "0 auto", padding: "20px 16px 120px" }}>
        {/* Filter + Add */}
        <section style={sectionStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: showAddForm ? 14 : 0 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[
                ["all", "سب"],
                ["draft", "Draft"],
                ["published", "Published"],
                ["archived", "Archived"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setStatusFilter(key)}
                  style={{
                    border: `1px solid ${theme.border}`,
                    borderRadius: 999,
                    padding: "6px 12px",
                    fontSize: "0.78rem",
                    cursor: "pointer",
                    background: statusFilter === key ? theme.primary : "#FDFCF9",
                    color: statusFilter === key ? "#FBF9F4" : theme.textStrong,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowAddForm((v) => !v)}
              style={{ display: "flex", alignItems: "center", gap: 6, background: theme.primary, color: "#FBF9F4", border: "none", borderRadius: 999, padding: "8px 16px", fontSize: "0.82rem", cursor: "pointer" }}
            >
              {showAddForm ? "بند کریں" : "+ نئی حوصلہ افزائی شامل کریں"}
            </button>
          </div>

          {showAddForm && (
            <div style={{ borderTop: `1px dashed ${theme.border}`, paddingTop: 14 }}>
              {AchievementFormFields({ f: form, setF: setForm })}
              <button
                onClick={addAchievement}
                disabled={!form.memberId || !form.title.trim()}
                style={{ marginTop: 12, background: theme.primary, color: "#FBF9F4", border: "none", borderRadius: 10, padding: "9px 18px", fontSize: "0.85rem", cursor: "pointer", opacity: form.memberId && form.title.trim() ? 1 : 0.5 }}
              >
                Draft کے طور پر محفوظ کریں
              </button>
            </div>
          )}
        </section>

        {/* List */}
        <section style={sectionStyle}>
          <h2 style={{ fontFamily: "'Noto Nastaliq Urdu', serif", fontSize: "1.05rem", color: theme.primary, margin: "0 0 12px" }}>
            Achievements History
          </h2>
          <div style={{ display: "grid", gap: 10 }}>
            {visibleAchievements.length === 0 && (
              <p style={{ fontSize: "0.85rem", color: theme.textMuted, textAlign: "center", margin: 0 }}>اس فہرست میں کوئی ریکارڈ موجود نہیں۔</p>
            )}
            {visibleAchievements.map((a, idx) => (
              <div key={a.id} style={{ border: `1px solid ${theme.border}`, borderRadius: 12, padding: 12, background: "#FDFCF9" }}>
                {editingId === a.id ? (
                  <div>
                    {AchievementFormFields({ f: editForm, setF: setEditForm })}
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <button onClick={() => saveEdit(a.id)} style={{ background: theme.primary, color: "#FBF9F4", border: "none", borderRadius: 9, padding: "7px 14px", fontSize: "0.8rem", cursor: "pointer" }}>
                        محفوظ کریں
                      </button>
                      <button onClick={() => setEditingId(null)} style={{ background: "#fff", border: `1px solid ${theme.border}`, color: theme.textMuted, borderRadius: 9, padding: "7px 14px", fontSize: "0.8rem", cursor: "pointer" }}>
                        منسوخ
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                      <div style={{ display: "flex", gap: 2 }}>
                        <button onClick={() => moveAchievement(a.id, "up")} disabled={idx === 0} style={{ ...iconBtnStyle(theme), opacity: idx === 0 ? 0.35 : 1 }} aria-label="اوپر">
                          <ChevronUp size={13} />
                        </button>
                        <button onClick={() => moveAchievement(a.id, "down")} disabled={idx === visibleAchievements.length - 1} style={{ ...iconBtnStyle(theme), opacity: idx === visibleAchievements.length - 1 ? 0.35 : 1 }} aria-label="نیچے">
                          <ChevronDown size={13} />
                        </button>
                      </div>
                      <strong>{memberLabel(a.memberId)}</strong>
                      <span style={{ background: "rgba(184,134,43,0.14)", color: theme.accent, borderRadius: 999, padding: "3px 10px", fontSize: "0.7rem" }}>{a.type}</span>
                      <span
                        style={{
                          borderRadius: 999,
                          padding: "3px 10px",
                          fontSize: "0.7rem",
                          background: a.status === "published" ? "rgba(11,79,63,0.1)" : a.status === "archived" ? "rgba(91,107,98,0.14)" : "rgba(184,134,43,0.14)",
                          color: a.status === "published" ? theme.primary : a.status === "archived" ? theme.textMuted : theme.accent,
                        }}
                      >
                        {a.status === "published" ? "Published" : a.status === "archived" ? "Archived" : "Draft"}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: 2 }}>{a.title}</div>
                    <div style={{ fontSize: "0.75rem", color: theme.textMuted, marginBottom: 6 }}>{a.period}</div>
                    {a.description && <p style={{ fontSize: "0.82rem", color: theme.textStrong, lineHeight: 1.9, margin: "0 0 8px" }}>{a.description}</p>}

                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button onClick={() => startEdit(a)} style={{ border: `1px solid ${theme.border}`, background: "#fff", color: theme.primary, borderRadius: 999, padding: "5px 11px", fontSize: "0.72rem", cursor: "pointer" }}>
                        ترمیم
                      </button>
                      {a.status === "draft" && (
                        <button onClick={() => setStatus(a.id, "published")} style={{ border: "none", background: "rgba(11,79,63,0.1)", color: theme.primary, borderRadius: 999, padding: "5px 11px", fontSize: "0.72rem", cursor: "pointer" }}>
                          شائع کریں (Publish)
                        </button>
                      )}
                      {a.status === "published" && (
                        <button onClick={() => setStatus(a.id, "archived")} style={{ border: "none", background: "rgba(91,107,98,0.14)", color: theme.textMuted, borderRadius: 999, padding: "5px 11px", fontSize: "0.72rem", cursor: "pointer" }}>
                          آرکائیو کریں (Archive)
                        </button>
                      )}
                      {a.status === "archived" && (
                        <button onClick={() => setStatus(a.id, "published")} style={{ border: "none", background: "rgba(11,79,63,0.1)", color: theme.primary, borderRadius: 999, padding: "5px 11px", fontSize: "0.72rem", cursor: "pointer" }}>
                          بحال کریں (Restore)
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>

      <div style={{ position: "fixed", bottom: 0, insetInlineStart: 0, insetInlineEnd: 0, background: "#FFFFFF", borderTop: `1px solid ${theme.border}`, padding: "12px 16px", display: "flex", justifyContent: "center", gap: 12, boxShadow: "0 -6px 16px rgba(31,42,36,0.08)", zIndex: 25 }}>
        {savedFlash && (
          <span style={{ display: "flex", alignItems: "center", gap: 6, color: theme.primary, fontSize: "0.85rem", alignSelf: "center" }}>
            <CheckCircle2 size={16} /> تبدیلیاں کامیابی سے محفوظ ہوگئیں
          </span>
        )}
        <button
          onClick={handleSave}
          style={{ display: "flex", alignItems: "center", gap: 8, background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryDark} 100%)`, color: "#FBF9F4", border: "none", borderRadius: 12, padding: "12px 28px", fontSize: "0.95rem", fontFamily: "'Noto Naskh Arabic', serif", cursor: "pointer", boxShadow: "0 6px 16px rgba(11,79,63,0.28)" }}
        >
          <Save size={17} />
          تبدیلیاں محفوظ کریں
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   REPORTS SYSTEM (Phase 1B — Reports Management)
   ------------------------------------------------------------
   Purely a read-only reporting layer. It introduces NO new
   financial calculation — every number here is a plain sum of
   fields already computed elsewhere:
     - paidFund / donation / arrears  → from FundsManagement's
       `payments` records (computeFundBreakdown already ran once,
       at entry time; reports never re-run it)
     - amount                          → from ExpensesManagement's
       `expenses` records (archived ones excluded, same rule as
       ExpensesManagement/FinancialSummary)

   Date filtering (All Time / Month / Year / Custom Range) reuses
   the same approach as FinancialSummary: payments are filtered by
   month/year fields or paymentDate, expenses by date.

   `orgName` is threaded in so every report can show the
   organization's current branding — the same value Admin edits
   in Settings — laying the groundwork for a future PDF export
   without any restructuring.
   ============================================================ */
function groupSum(items, keyFn, valueFn) {
  const map = {};
  items.forEach((item) => {
    const key = keyFn(item);
    map[key] = (map[key] || 0) + valueFn(item);
  });
  return map;
}

const REPORT_TABS = [
  { key: "members", label: "Members" },
  { key: "funds", label: "Funds" },
  { key: "arrears", label: "Arrears" },
  { key: "donations", label: "Donations" },
  { key: "expenses", label: "Expenses" },
  { key: "summary", label: "Financial Summary" },
];

function ReportsManagement({ theme, orgName, orgNameEnglish, shortName, members, payments, expenses, currency, onBack }) {
  const now = new Date();
  const [activeTab, setActiveTab] = useState("members");
  const [filterMode, setFilterMode] = useState("all"); // all | month | year | range
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [memberStatusFilter, setMemberStatusFilter] = useState("all"); // all | active | inactive | archived
  const [reportMemberId, setReportMemberId] = useState("");

  const activeExpenses = expenses.filter((e) => e.status === "active");

  let filteredPayments = payments;
  let filteredExpenses = activeExpenses;
  if (filterMode === "month") {
    filteredPayments = payments.filter((p) => p.month === Number(filterMonth) && p.year === Number(filterYear));
    filteredExpenses = activeExpenses.filter((e) => {
      const d = new Date(e.date);
      return d.getMonth() + 1 === Number(filterMonth) && d.getFullYear() === Number(filterYear);
    });
  } else if (filterMode === "year") {
    filteredPayments = payments.filter((p) => p.year === Number(filterYear));
    filteredExpenses = activeExpenses.filter((e) => new Date(e.date).getFullYear() === Number(filterYear));
  } else if (filterMode === "range") {
    filteredPayments = payments.filter((p) => inRange(p.paymentDate, rangeStart, rangeEnd));
    filteredExpenses = activeExpenses.filter((e) => inRange(e.date, rangeStart, rangeEnd));
  }

  function memberName(memberId) {
    const m = members.find((mm) => mm.id === memberId);
    return m ? `${m.name} (${m.memberId})` : "نامعلوم رکن";
  }

  const sectionStyle = {
    background: "#FFFFFF",
    border: `1px solid ${theme.border}`,
    borderRadius: 16,
    padding: "16px",
    marginBottom: 16,
    boxShadow: "0 1px 2px rgba(31,42,36,0.06)",
  };
  const labelStyle = { display: "block", fontSize: "0.78rem", color: theme.textMuted, marginBottom: 4 };
  const inputStyle = {
    boxSizing: "border-box",
    padding: "9px 10px",
    borderRadius: 9,
    border: `1px solid ${theme.border}`,
    fontFamily: "'Noto Naskh Arabic', serif",
    fontSize: "0.9rem",
    color: theme.textStrong,
    background: "#FDFCF9",
  };
  const tableHeadStyle = { textAlign: "start", fontSize: "0.72rem", color: theme.textMuted, padding: "6px 8px", borderBottom: `1px solid ${theme.border}` };
  const tableCellStyle = { fontSize: "0.8rem", padding: "6px 8px", borderBottom: `1px solid ${theme.border}` };

  function statCard(label, value, color) {
    return (
      <div style={{ flex: "1 1 150px", border: `1px solid ${theme.border}`, borderRadius: 12, padding: "12px", textAlign: "center", background: "#FDFCF9" }}>
        <div style={{ fontSize: "1.2rem", fontWeight: 700, color: color || theme.primary }}>{value} {currency}</div>
        <div style={{ fontSize: "0.75rem", color: theme.textMuted, marginTop: 2 }}>{label}</div>
      </div>
    );
  }

  function DateFilterBar() {
    return (
      <section className="no-print" style={sectionStyle}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {[
            ["all", "All Time"],
            ["month", "Selected Month"],
            ["year", "Selected Year"],
            ["range", "Custom Date Range"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilterMode(key)}
              style={{
                border: `1px solid ${theme.border}`,
                borderRadius: 999,
                padding: "6px 14px",
                fontSize: "0.78rem",
                cursor: "pointer",
                background: filterMode === key ? theme.primary : "#FDFCF9",
                color: filterMode === key ? "#FBF9F4" : theme.textStrong,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {filterMode === "month" && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div>
              <label style={labelStyle}>مہینہ</label>
              <select style={inputStyle} value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}>
                {MONTH_NAMES_UR.map((name, idx) => (
                  <option key={name} value={idx + 1}>{name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>سال</label>
              <input type="number" style={{ ...inputStyle, direction: "ltr", maxWidth: 110 }} value={filterYear} onChange={(e) => setFilterYear(e.target.value)} />
            </div>
          </div>
        )}
        {filterMode === "year" && (
          <div>
            <label style={labelStyle}>سال</label>
            <input type="number" style={{ ...inputStyle, direction: "ltr", maxWidth: 110 }} value={filterYear} onChange={(e) => setFilterYear(e.target.value)} />
          </div>
        )}
        {filterMode === "range" && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div>
              <label style={labelStyle}>شروع تاریخ</label>
              <input type="date" style={{ ...inputStyle, direction: "ltr" }} value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>آخری تاریخ</label>
              <input type="date" style={{ ...inputStyle, direction: "ltr" }} value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} />
            </div>
          </div>
        )}
      </section>
    );
  }

  function renderMembersReport() {
    const filteredMembers = memberStatusFilter === "all" ? members : members.filter((m) => m.status === memberStatusFilter);
    const memberTotals = {};
    filteredPayments.forEach((p) => {
      if (!memberTotals[p.memberId]) memberTotals[p.memberId] = { fund: 0, donation: 0, arrears: 0 };
      memberTotals[p.memberId].fund += p.paidFund;
      memberTotals[p.memberId].donation += p.donation;
      memberTotals[p.memberId].arrears += p.arrears;
    });

    if (reportMemberId) {
      const m = members.find((mm) => mm.id === reportMemberId);
      const memberPayments = filteredPayments.filter((p) => p.memberId === reportMemberId).sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));
      const t = memberTotals[reportMemberId] || { fund: 0, donation: 0, arrears: 0 };
      return (
        <section style={sectionStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            <h3 style={{ margin: 0, color: theme.primary, fontFamily: "'Noto Nastaliq Urdu', serif" }}>{m ? m.name : "رکن"} کی مکمل رپورٹ</h3>
            <button onClick={() => setReportMemberId("")} style={{ border: `1px solid ${theme.border}`, background: "#fff", color: theme.textMuted, borderRadius: 999, padding: "5px 12px", fontSize: "0.75rem", cursor: "pointer" }}>
              تمام ممبران دیکھیں
            </button>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            {statCard("Paid Fund", t.fund)}
            {statCard("Donations", t.donation)}
            {statCard("Arrears", t.arrears, theme.accent)}
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={tableHeadStyle}>مہینہ/سال</th>
                <th style={tableHeadStyle}>ادا کردہ</th>
                <th style={tableHeadStyle}>Paid Fund</th>
                <th style={tableHeadStyle}>Donation</th>
                <th style={tableHeadStyle}>Arrears</th>
                <th style={tableHeadStyle}>تاریخ</th>
              </tr>
            </thead>
            <tbody>
              {memberPayments.map((p) => (
                <tr key={p.id}>
                  <td style={tableCellStyle}>{MONTH_NAMES_UR[p.month - 1]} {p.year}</td>
                  <td style={tableCellStyle}>{p.paidAmount}</td>
                  <td style={tableCellStyle}>{p.paidFund}</td>
                  <td style={tableCellStyle}>{p.donation}</td>
                  <td style={tableCellStyle}>{p.arrears}</td>
                  <td style={tableCellStyle}>{p.paymentDate}</td>
                </tr>
              ))}
              {memberPayments.length === 0 && (
                <tr><td colSpan="6" style={{ ...tableCellStyle, textAlign: "center", color: theme.textMuted }}>اس مدت میں کوئی ریکارڈ نہیں۔</td></tr>
              )}
            </tbody>
          </table>
        </section>
      );
    }

    return (
      <>
        <section style={sectionStyle}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            {[
              ["all", "سب"],
              ["active", "فعال"],
              ["inactive", "غیر فعال"],
              ["archived", "آرکائیو"],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setMemberStatusFilter(key)}
                style={{
                  border: `1px solid ${theme.border}`,
                  borderRadius: 999,
                  padding: "6px 12px",
                  fontSize: "0.78rem",
                  cursor: "pointer",
                  background: memberStatusFilter === key ? theme.primary : "#FDFCF9",
                  color: memberStatusFilter === key ? "#FBF9F4" : theme.textStrong,
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={tableHeadStyle}>نام</th>
                <th style={tableHeadStyle}>Member ID</th>
                <th style={tableHeadStyle}>Status</th>
                <th style={tableHeadStyle}>Paid Fund</th>
                <th style={tableHeadStyle}>Donations</th>
                <th style={tableHeadStyle}>Arrears</th>
                <th style={tableHeadStyle}></th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map((m) => {
                const t = memberTotals[m.id] || { fund: 0, donation: 0, arrears: 0 };
                return (
                  <tr key={m.id}>
                    <td style={tableCellStyle}>{m.name}</td>
                    <td style={{ ...tableCellStyle, direction: "ltr", textAlign: "left" }}>{m.memberId}</td>
                    <td style={tableCellStyle}>{STATUS_LABELS_UR[m.status]}</td>
                    <td style={tableCellStyle}>{t.fund}</td>
                    <td style={tableCellStyle}>{t.donation}</td>
                    <td style={tableCellStyle}>{t.arrears}</td>
                    <td style={tableCellStyle}>
                      <button onClick={() => setReportMemberId(m.id)} style={{ border: `1px solid ${theme.border}`, background: "#fff", color: theme.primary, borderRadius: 999, padding: "3px 10px", fontSize: "0.7rem", cursor: "pointer" }}>
                        مکمل رپورٹ
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredMembers.length === 0 && (
                <tr><td colSpan="7" style={{ ...tableCellStyle, textAlign: "center", color: theme.textMuted }}>کوئی رکن موجود نہیں۔</td></tr>
              )}
            </tbody>
          </table>
        </section>
      </>
    );
  }

  function renderFundsReport() {
    const byMonth = groupSum(filteredPayments, (p) => `${p.year}-${String(p.month).padStart(2, "0")}`, (p) => p.paidFund);
    const byYear = groupSum(filteredPayments, (p) => p.year, (p) => p.paidFund);
    const totalFund = filteredPayments.reduce((s, p) => s + p.paidFund, 0);
    const totalDonation = filteredPayments.reduce((s, p) => s + p.donation, 0);

    return (
      <>
        <section style={sectionStyle}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {statCard("Total Paid Fund", totalFund)}
            {statCard("Total Donations (الگ)", totalDonation)}
          </div>
        </section>
        <section style={sectionStyle}>
          <h3 style={{ margin: "0 0 10px", color: theme.primary, fontFamily: "'Noto Nastaliq Urdu', serif", fontSize: "1rem" }}>Monthly Fund Report</h3>
          <ReportBarList entries={Object.entries(byMonth).sort()} theme={theme} currency={currency} />
        </section>
        <section style={sectionStyle}>
          <h3 style={{ margin: "0 0 10px", color: theme.primary, fontFamily: "'Noto Nastaliq Urdu', serif", fontSize: "1rem" }}>Annual Fund Report</h3>
          <ReportBarList entries={Object.entries(byYear).sort()} theme={theme} currency={currency} />
        </section>
        <section style={sectionStyle}>
          <label style={labelStyle}>Member کا پورے سال کا Fund حساب دیکھیں</label>
          <select style={inputStyle} value={reportMemberId} onChange={(e) => setReportMemberId(e.target.value)}>
            <option value="">منتخب کریں</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name} ({m.memberId})</option>
            ))}
          </select>
          {reportMemberId && (() => {
            const memberYearly = groupSum(filteredPayments.filter((p) => p.memberId === reportMemberId), (p) => p.year, (p) => p.paidFund);
            const memberDonYearly = groupSum(filteredPayments.filter((p) => p.memberId === reportMemberId), (p) => p.year, (p) => p.donation);
            return (
              <div style={{ marginTop: 12 }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr><th style={tableHeadStyle}>سال</th><th style={tableHeadStyle}>Paid Fund</th><th style={tableHeadStyle}>Donations</th></tr></thead>
                  <tbody>
                    {Object.keys(memberYearly).sort().map((year) => (
                      <tr key={year}>
                        <td style={tableCellStyle}>{year}</td>
                        <td style={tableCellStyle}>{memberYearly[year]}</td>
                        <td style={tableCellStyle}>{memberDonYearly[year] || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </section>
      </>
    );
  }

  function renderArrearsReport() {
    const byMember = groupSum(filteredPayments.filter((p) => p.arrears > 0), (p) => p.memberId, (p) => p.arrears);
    const byMonth = groupSum(filteredPayments.filter((p) => p.arrears > 0), (p) => `${p.year}-${String(p.month).padStart(2, "0")}`, (p) => p.arrears);
    const total = filteredPayments.reduce((s, p) => s + p.arrears, 0);

    return (
      <>
        <section style={sectionStyle}>{statCard("Total Arrears", total, theme.accent)}</section>
        <section style={sectionStyle}>
          <h3 style={{ margin: "0 0 10px", color: theme.primary, fontFamily: "'Noto Nastaliq Urdu', serif", fontSize: "1rem" }}>Member-wise Arrears</h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={tableHeadStyle}>رکن</th><th style={tableHeadStyle}>Arrears</th></tr></thead>
            <tbody>
              {Object.entries(byMember).sort((a, b) => b[1] - a[1]).map(([memberId, amount]) => (
                <tr key={memberId}><td style={tableCellStyle}>{memberName(memberId)}</td><td style={tableCellStyle}>{amount} {currency}</td></tr>
              ))}
              {Object.keys(byMember).length === 0 && <tr><td colSpan="2" style={{ ...tableCellStyle, textAlign: "center", color: theme.textMuted }}>کوئی بقایاجات نہیں۔</td></tr>}
            </tbody>
          </table>
        </section>
        <section style={sectionStyle}>
          <h3 style={{ margin: "0 0 10px", color: theme.primary, fontFamily: "'Noto Nastaliq Urdu', serif", fontSize: "1rem" }}>Month-wise Arrears</h3>
          <ReportBarList entries={Object.entries(byMonth).sort()} theme={theme} currency={currency} color={theme.accent} />
        </section>
      </>
    );
  }

  function renderDonationsReport() {
    const byMember = groupSum(filteredPayments.filter((p) => p.donation > 0), (p) => p.memberId, (p) => p.donation);
    const byMonth = groupSum(filteredPayments, (p) => `${p.year}-${String(p.month).padStart(2, "0")}`, (p) => p.donation);
    const byYear = groupSum(filteredPayments, (p) => p.year, (p) => p.donation);
    const total = filteredPayments.reduce((s, p) => s + p.donation, 0);

    return (
      <>
        <section style={sectionStyle}>{statCard("Total Donations", total)}</section>
        <section style={sectionStyle}>
          <h3 style={{ margin: "0 0 10px", color: theme.primary, fontFamily: "'Noto Nastaliq Urdu', serif", fontSize: "1rem" }}>Member-wise Donations</h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={tableHeadStyle}>رکن</th><th style={tableHeadStyle}>Donation</th></tr></thead>
            <tbody>
              {Object.entries(byMember).sort((a, b) => b[1] - a[1]).map(([memberId, amount]) => (
                <tr key={memberId}><td style={tableCellStyle}>{memberName(memberId)}</td><td style={tableCellStyle}>{amount} {currency}</td></tr>
              ))}
              {Object.keys(byMember).length === 0 && <tr><td colSpan="2" style={{ ...tableCellStyle, textAlign: "center", color: theme.textMuted }}>کوئی عطیات نہیں۔</td></tr>}
            </tbody>
          </table>
        </section>
        <section style={sectionStyle}>
          <h3 style={{ margin: "0 0 10px", color: theme.primary, fontFamily: "'Noto Nastaliq Urdu', serif", fontSize: "1rem" }}>Monthly Donations</h3>
          <ReportBarList entries={Object.entries(byMonth).sort()} theme={theme} currency={currency} />
        </section>
        <section style={sectionStyle}>
          <h3 style={{ margin: "0 0 10px", color: theme.primary, fontFamily: "'Noto Nastaliq Urdu', serif", fontSize: "1rem" }}>Yearly Donations</h3>
          <ReportBarList entries={Object.entries(byYear).sort()} theme={theme} currency={currency} />
        </section>
      </>
    );
  }

  function renderExpensesReport() {
    const byMonth = groupSum(filteredExpenses, (e) => { const d = new Date(e.date); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }, (e) => e.amount);
    const byYear = groupSum(filteredExpenses, (e) => new Date(e.date).getFullYear(), (e) => e.amount);
    const byCategory = groupSum(filteredExpenses, (e) => e.category, (e) => e.amount);
    const total = filteredExpenses.reduce((s, e) => s + e.amount, 0);
    const history = [...filteredExpenses].sort((a, b) => new Date(b.date) - new Date(a.date));

    return (
      <>
        <section style={sectionStyle}>
          {statCard("Total Expenses", total, theme.accent)}
          <p style={{ fontSize: "0.72rem", color: theme.textMuted, marginTop: 10, marginBottom: 0 }}>آرکائیو شدہ اخراجات شامل نہیں۔</p>
        </section>
        <section style={sectionStyle}>
          <h3 style={{ margin: "0 0 10px", color: theme.primary, fontFamily: "'Noto Nastaliq Urdu', serif", fontSize: "1rem" }}>Monthly Expenses</h3>
          <ReportBarList entries={Object.entries(byMonth).sort()} theme={theme} currency={currency} color={theme.accent} />
        </section>
        <section style={sectionStyle}>
          <h3 style={{ margin: "0 0 10px", color: theme.primary, fontFamily: "'Noto Nastaliq Urdu', serif", fontSize: "1rem" }}>Annual Expenses</h3>
          <ReportBarList entries={Object.entries(byYear).sort()} theme={theme} currency={currency} color={theme.accent} />
        </section>
        <section style={sectionStyle}>
          <h3 style={{ margin: "0 0 10px", color: theme.primary, fontFamily: "'Noto Nastaliq Urdu', serif", fontSize: "1rem" }}>Category-wise Expenses</h3>
          <ReportBarList entries={Object.entries(byCategory).sort((a, b) => b[1] - a[1])} theme={theme} currency={currency} color={theme.accent} />
        </section>
        <section style={sectionStyle}>
          <h3 style={{ margin: "0 0 10px", color: theme.primary, fontFamily: "'Noto Nastaliq Urdu', serif", fontSize: "1rem" }}>Complete Expense History</h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={tableHeadStyle}>Title</th><th style={tableHeadStyle}>Category</th><th style={tableHeadStyle}>Amount</th><th style={tableHeadStyle}>Date</th></tr></thead>
            <tbody>
              {history.map((e) => (
                <tr key={e.id}>
                  <td style={tableCellStyle}>{e.title}</td>
                  <td style={tableCellStyle}>{e.category}</td>
                  <td style={tableCellStyle}>{e.amount} {currency}</td>
                  <td style={tableCellStyle}>{e.date}</td>
                </tr>
              ))}
              {history.length === 0 && <tr><td colSpan="4" style={{ ...tableCellStyle, textAlign: "center", color: theme.textMuted }}>اس مدت میں کوئی Expense نہیں۔</td></tr>}
            </tbody>
          </table>
        </section>
      </>
    );
  }

  function renderFinancialSummaryReport() {
    const totalPaidFund = filteredPayments.reduce((s, p) => s + p.paidFund, 0);
    const totalDonations = filteredPayments.reduce((s, p) => s + p.donation, 0);
    const totalArrears = filteredPayments.reduce((s, p) => s + p.arrears, 0);
    const totalIncome = totalPaidFund + totalDonations;
    const totalExpenses = filteredExpenses.reduce((s, e) => s + e.amount, 0);
    const balance = totalIncome - totalExpenses;

    return (
      <section style={sectionStyle}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {statCard("Total Paid Fund", totalPaidFund)}
          {statCard("Total Donations", totalDonations)}
          {statCard("Total Income", totalIncome)}
          {statCard("Total Expenses", totalExpenses, theme.accent)}
          {statCard("Balance", balance, balance >= 0 ? theme.primary : theme.accent)}
          {statCard("Total Arrears", totalArrears, theme.accent)}
        </div>
        <p style={{ fontSize: "0.72rem", color: theme.textMuted, marginTop: 10, marginBottom: 0 }}>
          Balance = Total Income (Paid Fund + Donations) − Total Expenses۔ آرکائیو شدہ اخراجات شامل نہیں۔
        </p>
      </section>
    );
  }

  /* ---- PDF generation (browser print → Save as PDF) ----
     Urdu/Nastaliq text needs proper script shaping + RTL
     reordering, which libraries like jsPDF cannot do without a
     bundled shaping engine and a paid/complex setup. The
     browser's own print engine already renders this page's Urdu
     correctly (same Google Fonts already loaded above), so
     printing IS the PDF generator here — no new dependency, no
     paid service, and no broken/garbled Urdu output. */
  function activeReportTitle() {
    if (activeTab === "members") {
      if (reportMemberId) {
        const m = members.find((mm) => mm.id === reportMemberId);
        return `Individual Member Report — ${m ? m.name : ""}`;
      }
      return "Members Report";
    }
    if (activeTab === "funds") return "Funds Report (Monthly & Annual)";
    if (activeTab === "arrears") return "Arrears Report";
    if (activeTab === "donations") return "Donations Report";
    if (activeTab === "expenses") return "Expenses Report";
    if (activeTab === "summary") return "Financial Summary Report";
    return "Report";
  }

  function filterRangeLabel() {
    if (filterMode === "month") return `${MONTH_NAMES_UR[filterMonth - 1]} ${filterYear}`;
    if (filterMode === "year") return `سال ${filterYear}`;
    if (filterMode === "range") return `${rangeStart || "..."} — ${rangeEnd || "..."}`;
    return "All Time";
  }

  function handleGeneratePdf() {
    const prevTitle = document.title;
    document.title = `${orgName || "Report"} - ${activeReportTitle()}`;
    window.print();
    setTimeout(() => { document.title = prevTitle; }, 500);
  }

  return (
    <div dir="rtl" lang="ur" className="kw-print-page" style={{ minHeight: "100vh", background: `linear-gradient(180deg, ${theme.background} 0%, ${theme.backgroundAlt} 100%)`, fontFamily: "'Noto Naskh Arabic', serif", color: theme.textStrong }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400..700&family=Noto+Naskh+Arabic:wght@400..700&display=swap');
        .print-header { display: none; }
        @media print {
          .no-print { display: none !important; }
          .print-header { display: block !important; }
          .kw-print-page { background: #ffffff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      {/* Print-only header: org identity + report title + selected date range + generation date.
          Hidden on screen, shown only inside the printed/PDF output. */}
      <div className="print-header" style={{ padding: "18px 4px 14px", borderBottom: "2px solid #ccc", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div
            style={{
              width: 44, height: 44, borderRadius: 10, background: theme.accent, color: "#1F2A24",
              display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 15,
            }}
          >
            {shortName}
          </div>
          <div>
            <div style={{ fontFamily: "'Noto Nastaliq Urdu', serif", fontWeight: 700, fontSize: "1.1rem" }}>{orgName}</div>
            {orgNameEnglish && <div style={{ fontSize: "0.8rem", color: "#555" }}>{orgNameEnglish}</div>}
          </div>
        </div>
        <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: 4 }}>{activeReportTitle()}</div>
        <div style={{ fontSize: "0.82rem", color: "#333" }}>منتخب مدت: {filterRangeLabel()}</div>
        <div style={{ fontSize: "0.72rem", color: "#666", marginTop: 2 }}>PDF تیار کرنے کی تاریخ: {new Date().toLocaleDateString("en-GB")}</div>
      </div>

      <header className="no-print" style={{ background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryDark} 100%)`, color: "#FBF9F4", position: "sticky", top: 0, zIndex: 20, padding: "14px 18px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ClipboardList size={20} />
            <div>
              <h1 style={{ fontFamily: "'Noto Nastaliq Urdu', serif", fontSize: "1.15rem", margin: 0 }}>رپورٹس</h1>
              <span style={{ fontSize: "0.7rem", color: "rgba(251,249,244,0.75)" }}>{orgName}</span>
            </div>
          </div>
          <button
            onClick={onBack}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(251,249,244,0.14)", border: "1px solid rgba(251,249,244,0.35)", color: "#FBF9F4", borderRadius: 999, padding: "7px 14px", fontSize: "0.85rem", cursor: "pointer", fontFamily: "'Noto Naskh Arabic', serif" }}
          >
            <ArrowRight size={15} />
            ایڈمن پینل
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 960, margin: "0 auto", padding: "20px 16px 60px" }}>
        <section className="no-print" style={{ ...sectionStyle, padding: "10px 12px" }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {REPORT_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => { setActiveTab(tab.key); setReportMemberId(""); }}
                  style={{
                    border: "none",
                    borderRadius: 999,
                    padding: "7px 14px",
                    fontSize: "0.8rem",
                    cursor: "pointer",
                    background: activeTab === tab.key ? theme.primary : "rgba(11,79,63,0.06)",
                    color: activeTab === tab.key ? "#FBF9F4" : theme.textStrong,
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <button
              onClick={handleGeneratePdf}
              style={{ display: "flex", alignItems: "center", gap: 6, background: theme.accent, color: "#1F2A24", border: "none", borderRadius: 999, padding: "8px 16px", fontSize: "0.8rem", cursor: "pointer", fontWeight: 600 }}
            >
              <FileBarChart size={15} />
              PDF بنائیں / Download
            </button>
          </div>
        </section>

        {DateFilterBar()}

        {activeTab === "members" && renderMembersReport()}
        {activeTab === "funds" && renderFundsReport()}
        {activeTab === "arrears" && renderArrearsReport()}
        {activeTab === "donations" && renderDonationsReport()}
        {activeTab === "expenses" && renderExpensesReport()}
        {activeTab === "summary" && renderFinancialSummaryReport()}
      </main>
    </div>
  );
}

function ReportBarList({ entries, theme, currency, color }) {
  if (entries.length === 0) {
    return <p style={{ fontSize: "0.85rem", color: theme.textMuted, margin: 0 }}>اس مدت میں کوئی ریکارڈ نہیں۔</p>;
  }
  const max = Math.max(...entries.map(([, v]) => v), 1);
  return (
    <div>
      {entries.map(([key, value]) => {
        const pct = Math.round((value / max) * 100);
        return (
          <div key={key} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: 4 }}>
              <span>{key}</span>
              <strong style={{ color: theme.primary }}>{value} {currency}</strong>
            </div>
            <div style={{ height: 8, borderRadius: 999, background: "rgba(11,79,63,0.08)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: color || theme.primary, borderRadius: 999 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ============================================================
   AUTHENTICATION SCREENS (Firebase Auth — Phase: Admin login)
   ------------------------------------------------------------
   Only gates the Admin Panel and everything reachable from it.
   The public Home Page and all public card pages never touch
   this file's auth state and keep working exactly as before,
   logged in or not.

   No role/permission system beyond "signed in" yet — every
   signed-in Firebase user currently gets full Admin access,
   treated as "Super Admin". Limited Admin roles (e.g. via
   Firebase custom claims or a future Firestore "roles"
   collection) are intentionally NOT built here — that's a
   separate, later step.
   ============================================================ */
function AuthLoadingScreen({ theme }) {
  return (
    <div
      dir="rtl"
      lang="ur"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: `linear-gradient(180deg, ${theme.background} 0%, ${theme.backgroundAlt} 100%)`,
        fontFamily: "'Noto Naskh Arabic', serif",
        color: theme.textMuted,
      }}
    >
      لوڈ ہو رہا ہے...
    </div>
  );
}

function LoginScreen({ theme, orgNameUrdu, onBackToSite, message }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("براہ کرم ای میل اور پاس ورڈ درج کریں۔");
      return;
    }
    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      // onAuthStateChanged in <App> picks this up automatically.
    } catch (err) {
      setError("Login ناکام ہوا۔ ای میل یا پاس ورڈ درست نہیں، یا یہ اکاؤنٹ موجود نہیں۔");
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle = {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    borderRadius: 10,
    border: `1px solid ${theme.border}`,
    fontFamily: "'Noto Naskh Arabic', serif",
    fontSize: "0.92rem",
    color: theme.textStrong,
    background: "#FDFCF9",
    marginBottom: 12,
    direction: "ltr",
    textAlign: "left",
  };
  const labelStyle = { display: "block", fontSize: "0.8rem", color: theme.textMuted, marginBottom: 4 };

  return (
    <div
      dir="rtl"
      lang="ur"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 18,
        background: `linear-gradient(180deg, ${theme.background} 0%, ${theme.backgroundAlt} 100%)`,
        fontFamily: "'Noto Naskh Arabic', serif",
        color: theme.textStrong,
      }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400..700&family=Noto+Naskh+Arabic:wght@400..700&display=swap');`}</style>

      <form
        onSubmit={handleLogin}
        style={{
          width: "100%",
          maxWidth: 380,
          background: "#FFFFFF",
          border: `1px solid ${theme.border}`,
          borderRadius: 18,
          padding: "28px 24px",
          boxShadow: "0 12px 28px rgba(11,79,63,0.12)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div
            style={{
              width: 48, height: 48, borderRadius: 12, margin: "0 auto 12px",
              background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryDark} 100%)`,
              display: "flex", alignItems: "center", justifyContent: "center", color: "#FBF9F4",
            }}
          >
            <Settings size={22} />
          </div>
          <h1 style={{ fontFamily: "'Noto Nastaliq Urdu', serif", fontSize: "1.15rem", color: theme.primary, margin: "0 0 4px" }}>
            سپر ایڈمن لاگ اِن
          </h1>
          <p style={{ fontSize: "0.78rem", color: theme.textMuted, margin: 0 }}>{orgNameUrdu}</p>
        </div>

        {message && (
          <div style={{ background: "rgba(184,134,43,0.1)", color: theme.textStrong, borderRadius: 10, padding: "10px 12px", fontSize: "0.82rem", marginBottom: 16, textAlign: "center" }}>
            {message}
          </div>
        )}

        <label style={labelStyle}>Email</label>
        <input type="email" style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />

        <label style={labelStyle}>Password</label>
        <input type="password" style={inputStyle} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />

        {error && (
          <div style={{ background: "rgba(178,52,52,0.1)", color: "#B23434", borderRadius: 9, padding: "8px 10px", fontSize: "0.78rem", marginBottom: 12 }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          style={{
            width: "100%",
            background: theme.primary,
            color: "#FBF9F4",
            border: "none",
            borderRadius: 10,
            padding: "11px",
            fontSize: "0.9rem",
            fontFamily: "'Noto Naskh Arabic', serif",
            cursor: submitting ? "default" : "pointer",
            opacity: submitting ? 0.7 : 1,
            marginBottom: 10,
          }}
        >
          {submitting ? "براہ کرم انتظار کریں..." : "Login"}
        </button>

        <button
          type="button"
          onClick={onBackToSite}
          style={{
            width: "100%",
            background: "transparent",
            border: "none",
            color: theme.textMuted,
            fontSize: "0.8rem",
            cursor: "pointer",
            fontFamily: "'Noto Naskh Arabic', serif",
          }}
        >
          ویب سائٹ پر واپس جائیں
        </button>
      </form>
    </div>
  );
}

/* ============================================================
   ACCESS DENIED SCREEN
   ============================================================ */
function AccessDeniedScreen({ theme, message, onBack, onLogout }) {
  return (
    <div
      dir="rtl"
      lang="ur"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 18,
        background: `linear-gradient(180deg, ${theme.background} 0%, ${theme.backgroundAlt} 100%)`,
        fontFamily: "'Noto Naskh Arabic', serif",
        color: theme.textStrong,
      }}
    >
      <div style={{ maxWidth: 380, textAlign: "center", background: "#FFFFFF", border: `1px solid ${theme.border}`, borderRadius: 18, padding: "28px 24px", boxShadow: "0 12px 28px rgba(11,79,63,0.12)" }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, margin: "0 auto 14px", background: "rgba(184,134,43,0.14)", display: "flex", alignItems: "center", justifyContent: "center", color: theme.accent }}>
          <ShieldCheck size={22} />
        </div>
        <h1 style={{ fontFamily: "'Noto Nastaliq Urdu', serif", fontSize: "1.1rem", color: theme.primary, margin: "0 0 8px" }}>رسائی محدود ہے</h1>
        <p style={{ fontSize: "0.85rem", color: theme.textMuted, margin: "0 0 18px" }}>{message}</p>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={onBack} style={{ background: theme.primary, color: "#FBF9F4", border: "none", borderRadius: 999, padding: "8px 16px", fontSize: "0.82rem", cursor: "pointer" }}>
            واپس جائیں
          </button>
          <button onClick={onLogout} style={{ background: "#fff", border: `1px solid ${theme.border}`, color: theme.textMuted, borderRadius: 999, padding: "8px 16px", fontSize: "0.82rem", cursor: "pointer" }}>
            لاگ آؤٹ
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   ADMIN USERS MANAGEMENT (Super Admin only)
   ------------------------------------------------------------
   Manages Firestore adminRoles/{uid} docs. Because this is a
   client-only app (no Cloud Functions / Admin SDK), a new Limited
   Admin's Firebase Auth account still has to be created manually
   in the Firebase Console (Authentication → Users) — this screen
   only assigns that account's PERMISSIONS once you paste its UID.
   Never deletes a role doc — "Remove access" just sets active:false,
   so the assignment history/audit trail isn't lost.
   ============================================================ */
function emptyAdminUserForm() {
  return { uid: "", email: "", sections: [] };
}

function AdminUsersManagement({ theme, onBack }) {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState(emptyAdminUserForm());
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDocs(collection(db, "adminRoles"));
        setRoles(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Failed to load admin users:", err);
      }
      setLoading(false);
    }
    load();
  }, []);

  function toggleSection(setF, key) {
    setF((prev) => {
      const has = prev.sections.includes(key);
      return { ...prev, sections: has ? prev.sections.filter((s) => s !== key) : [...prev.sections, key] };
    });
  }

  async function addLimitedAdmin() {
    if (!form.uid.trim()) return;
    setSaving(true);
    try {
      const roleData = { email: form.email.trim(), role: "limited_admin", sections: form.sections, active: true };
      await setDoc(doc(db, "adminRoles", form.uid.trim()), roleData);
      setRoles((prev) => [...prev.filter((r) => r.id !== form.uid.trim()), { id: form.uid.trim(), ...roleData }]);
      setForm(emptyAdminUserForm());
      setShowAddForm(false);
      setFlash("Admin شامل ہو گیا۔");
    } catch (err) {
      console.error("Failed to save admin role:", err);
      setFlash("محفوظ کرنے میں مسئلہ ہوا۔");
    }
    setSaving(false);
    setTimeout(() => setFlash(""), 3000);
  }

  async function updateSections(uid, sections) {
    try {
      await setDoc(doc(db, "adminRoles", uid), { sections }, { merge: true });
      setRoles((prev) => prev.map((r) => (r.id === uid ? { ...r, sections } : r)));
    } catch (err) {
      console.error("Failed to update sections:", err);
    }
  }

  async function setActive(uid, active) {
    try {
      await setDoc(doc(db, "adminRoles", uid), { active }, { merge: true });
      setRoles((prev) => prev.map((r) => (r.id === uid ? { ...r, active } : r)));
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  }

  const sectionStyle = {
    background: "#FFFFFF",
    border: `1px solid ${theme.border}`,
    borderRadius: 16,
    padding: "16px",
    marginBottom: 16,
    boxShadow: "0 1px 2px rgba(31,42,36,0.06)",
  };
  const labelStyle = { display: "block", fontSize: "0.78rem", color: theme.textMuted, marginBottom: 4 };
  const inputStyle = {
    width: "100%",
    boxSizing: "border-box",
    padding: "9px 10px",
    borderRadius: 9,
    border: `1px solid ${theme.border}`,
    fontFamily: "'Noto Naskh Arabic', serif",
    fontSize: "0.9rem",
    color: theme.textStrong,
    background: "#FDFCF9",
    marginBottom: 0,
    direction: "ltr",
    textAlign: "left",
  };

  function SectionCheckboxes({ selected, onToggle }) {
    return (
      <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
        {SECTION_KEYS.map((key) => (
          <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.8rem", cursor: "pointer" }}>
            <input type="checkbox" checked={selected.includes(key)} onChange={() => onToggle(key)} />
            {SECTION_LABELS_UR[key]}
          </label>
        ))}
      </div>
    );
  }

  return (
    <div dir="rtl" lang="ur" style={{ minHeight: "100vh", background: `linear-gradient(180deg, ${theme.background} 0%, ${theme.backgroundAlt} 100%)`, fontFamily: "'Noto Naskh Arabic', serif", color: theme.textStrong }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400..700&family=Noto+Naskh+Arabic:wght@400..700&display=swap');`}</style>

      <header style={{ background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryDark} 100%)`, color: "#FBF9F4", position: "sticky", top: 0, zIndex: 20, padding: "14px 18px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ShieldCheck size={20} />
            <h1 style={{ fontFamily: "'Noto Nastaliq Urdu', serif", fontSize: "1.15rem", margin: 0 }}>Admin Users</h1>
          </div>
          <button
            onClick={onBack}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(251,249,244,0.14)", border: "1px solid rgba(251,249,244,0.35)", color: "#FBF9F4", borderRadius: 999, padding: "7px 14px", fontSize: "0.85rem", cursor: "pointer", fontFamily: "'Noto Naskh Arabic', serif" }}
          >
            <ArrowRight size={15} />
            ایڈمن پینل
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 900, margin: "0 auto", padding: "20px 16px 60px" }}>
        <section style={sectionStyle}>
          <p style={{ fontSize: "0.8rem", color: theme.textMuted, margin: "0 0 6px" }}>
            نیا Limited Admin شامل کرنے کے لیے: پہلے Firebase Console → Authentication → Users میں اس شخص کا email/password والا اکاؤنٹ بنائیں، وہاں سے اس کا UID کاپی کریں، پھر نیچے وہ UID اور اجازت شدہ حصے یہاں محفوظ کریں۔
          </p>
        </section>

        <section style={sectionStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <h2 style={{ fontFamily: "'Noto Nastaliq Urdu', serif", fontSize: "1.05rem", color: theme.primary, margin: 0 }}>نیا Limited Admin</h2>
            <button
              onClick={() => setShowAddForm((v) => !v)}
              style={{ background: theme.primary, color: "#FBF9F4", border: "none", borderRadius: 999, padding: "8px 16px", fontSize: "0.82rem", cursor: "pointer" }}
            >
              {showAddForm ? "بند کریں" : "+ شامل کریں"}
            </button>
          </div>

          {showAddForm && (
            <div style={{ marginTop: 14, borderTop: `1px dashed ${theme.border}`, paddingTop: 14 }}>
              <label style={labelStyle}>Firebase UID</label>
              <input style={{ ...inputStyle, marginBottom: 10 }} value={form.uid} onChange={(e) => setForm((p) => ({ ...p, uid: e.target.value }))} placeholder="Firebase Console سے کاپی کریں" />
              <label style={labelStyle}>Email (صرف شناخت کے لیے)</label>
              <input style={{ ...inputStyle, marginBottom: 10 }} value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
              <label style={labelStyle}>اجازت شدہ حصے</label>
              {SectionCheckboxes({ selected: form.sections, onToggle: (key) => toggleSection(setForm, key) })}
              <button
                onClick={addLimitedAdmin}
                disabled={!form.uid.trim() || saving}
                style={{ marginTop: 12, background: theme.primary, color: "#FBF9F4", border: "none", borderRadius: 10, padding: "9px 18px", fontSize: "0.85rem", cursor: "pointer", opacity: form.uid.trim() ? 1 : 0.5 }}
              >
                {saving ? "محفوظ ہو رہا ہے..." : "محفوظ کریں"}
              </button>
              {flash && <span style={{ marginRight: 10, fontSize: "0.8rem", color: theme.primary }}>{flash}</span>}
            </div>
          )}
        </section>

        <section style={sectionStyle}>
          <h2 style={{ fontFamily: "'Noto Nastaliq Urdu', serif", fontSize: "1.05rem", color: theme.primary, margin: "0 0 12px" }}>موجودہ Admins</h2>
          {loading && <p style={{ fontSize: "0.85rem", color: theme.textMuted }}>لوڈ ہو رہا ہے...</p>}
          {!loading && roles.length === 0 && <p style={{ fontSize: "0.85rem", color: theme.textMuted }}>ابھی کوئی Limited Admin شامل نہیں کیا گیا۔</p>}
          <div style={{ display: "grid", gap: 10 }}>
            {roles.map((r) => (
              <div key={r.id} style={{ border: `1px solid ${theme.border}`, borderRadius: 12, padding: 12, background: "#FDFCF9" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
                  <div>
                    <strong>{r.email || "(email محفوظ نہیں)"}</strong>
                    <div style={{ fontSize: "0.7rem", color: theme.textMuted, direction: "ltr", textAlign: "left" }}>{r.id}</div>
                  </div>
                  <span
                    style={{
                      borderRadius: 999, padding: "3px 10px", fontSize: "0.7rem",
                      background: r.active === false ? "rgba(178,52,52,0.12)" : "rgba(11,79,63,0.1)",
                      color: r.active === false ? "#B23434" : theme.primary,
                    }}
                  >
                    {r.active === false ? "معطل" : "فعال"}
                  </span>
                </div>
                {SectionCheckboxes({ selected: r.sections || [], onToggle: (key) => {
                  const has = (r.sections || []).includes(key);
                  const next = has ? (r.sections || []).filter((s) => s !== key) : [...(r.sections || []), key];
                  updateSections(r.id, next);
                } })}
                <div style={{ marginTop: 10 }}>
                  {r.active === false ? (
                    <button onClick={() => setActive(r.id, true)} style={{ border: "none", background: "rgba(11,79,63,0.1)", color: theme.primary, borderRadius: 999, padding: "5px 12px", fontSize: "0.72rem", cursor: "pointer" }}>
                      رسائی بحال کریں
                    </button>
                  ) : (
                    <button onClick={() => setActive(r.id, false)} style={{ border: "none", background: "rgba(178,52,52,0.1)", color: "#B23434", borderRadius: 999, padding: "5px 12px", fontSize: "0.72rem", cursor: "pointer" }}>
                      رسائی معطل کریں
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

/* ============================================================
   CONTACT INFORMATION MANAGEMENT (Phase 1)
   ------------------------------------------------------------
   Same no-database-of-its-own, draft-then-Save pattern as every
   other admin screen — draftContacts is local until "محفوظ کریں"
   is pressed, then lifted up via onApply(draftContacts), which
   App() merges into the SAME existing kwo/data document under
   contactInfo (persist({ contactInfo }) — see App()). Nothing
   about the existing document structure changes.
   ============================================================ */
function emptyContactForm() {
  return { type: "phone", value: "", label: "" };
}

function ContactManagement({ theme, contactInfo, onApply, onBack }) {
  const [draftContacts, setDraftContacts] = useState(contactInfo);
  const [savedFlash, setSavedFlash] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState(emptyContactForm());
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(emptyContactForm());

  function handleSave() {
    onApply(draftContacts);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2500);
  }

  function addContact() {
    if (!form.value.trim()) return;
    const record = {
      id: `contact-${Date.now()}`,
      type: form.type,
      value: form.value.trim(),
      label: form.label.trim(),
      status: "active",
    };
    setDraftContacts((prev) => [...prev, record]);
    setForm(emptyContactForm());
    setShowAddForm(false);
  }

  function startEdit(c) {
    setEditingId(c.id);
    setEditForm({ type: c.type, value: c.value, label: c.label });
  }

  function saveEdit(id) {
    setDraftContacts((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, type: editForm.type, value: editForm.value.trim() || c.value, label: editForm.label.trim() }
          : c
      )
    );
    setEditingId(null);
  }

  function toggleStatus(id) {
    setDraftContacts((prev) => prev.map((c) => (c.id === id ? { ...c, status: c.status === "active" ? "archived" : "active" } : c)));
  }

  function removeContact(id) {
    setDraftContacts((prev) => prev.filter((c) => c.id !== id));
  }

  const sectionStyle = {
    background: "#FFFFFF",
    border: `1px solid ${theme.border}`,
    borderRadius: 16,
    padding: "16px",
    marginBottom: 16,
    boxShadow: "0 1px 2px rgba(31,42,36,0.06)",
  };
  const labelStyle = { display: "block", fontSize: "0.78rem", color: theme.textMuted, marginBottom: 4 };
  const inputStyle = {
    width: "100%",
    boxSizing: "border-box",
    padding: "9px 10px",
    borderRadius: 9,
    border: `1px solid ${theme.border}`,
    fontFamily: "'Noto Naskh Arabic', serif",
    fontSize: "0.9rem",
    color: theme.textStrong,
    background: "#FDFCF9",
    marginBottom: 0,
  };

  function ContactFormFields({ f, setF }) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
        <div>
          <label style={labelStyle}>قسم (Type)</label>
          <select style={inputStyle} value={f.type} onChange={(e) => setF((p) => ({ ...p, type: e.target.value }))}>
            <option value="phone">فون نمبر (Phone)</option>
            <option value="email">ای میل (Email)</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>{f.type === "phone" ? "فون نمبر" : "ای میل ایڈریس"}</label>
          <input
            style={{ ...inputStyle, direction: "ltr", textAlign: "left" }}
            value={f.value}
            onChange={(e) => setF((p) => ({ ...p, value: e.target.value }))}
            placeholder={f.type === "phone" ? "+92 300 1234567" : "info@example.org"}
          />
        </div>
        <div>
          <label style={labelStyle}>Label (اختیاری)</label>
          <input
            style={inputStyle}
            value={f.label}
            onChange={(e) => setF((p) => ({ ...p, label: e.target.value }))}
            placeholder="مثلاً: سیکرٹری، خزانہ"
          />
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" lang="ur" style={{ minHeight: "100vh", background: `linear-gradient(180deg, ${theme.background} 0%, ${theme.backgroundAlt} 100%)`, fontFamily: "'Noto Naskh Arabic', serif", color: theme.textStrong }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400..700&family=Noto+Naskh+Arabic:wght@400..700&display=swap');`}</style>

      <header style={{ background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryDark} 100%)`, color: "#FBF9F4", position: "sticky", top: 0, zIndex: 20, padding: "14px 18px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Phone size={20} />
            <h1 style={{ fontFamily: "'Noto Nastaliq Urdu', serif", fontSize: "1.15rem", margin: 0 }}>رابطہ معلومات</h1>
          </div>
          <button
            onClick={onBack}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(251,249,244,0.14)", border: "1px solid rgba(251,249,244,0.35)", color: "#FBF9F4", borderRadius: 999, padding: "7px 14px", fontSize: "0.85rem", cursor: "pointer", fontFamily: "'Noto Naskh Arabic', serif" }}
          >
            <ArrowRight size={15} />
            ایڈمن پینل
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 900, margin: "0 auto", padding: "20px 16px 120px" }}>
        <section style={sectionStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: showAddForm ? 14 : 0 }}>
            <h2 style={{ fontFamily: "'Noto Nastaliq Urdu', serif", fontSize: "1.05rem", color: theme.primary, margin: 0 }}>
              فون نمبرز اور ای میلز
            </h2>
            <button
              onClick={() => setShowAddForm((v) => !v)}
              style={{ display: "flex", alignItems: "center", gap: 6, background: theme.primary, color: "#FBF9F4", border: "none", borderRadius: 999, padding: "8px 16px", fontSize: "0.82rem", cursor: "pointer" }}
            >
              {showAddForm ? "بند کریں" : "+ نیا Contact شامل کریں"}
            </button>
          </div>

          {showAddForm && (
            <div style={{ borderTop: `1px dashed ${theme.border}`, paddingTop: 14 }}>
              {ContactFormFields({ f: form, setF: setForm })}
              <button
                onClick={addContact}
                disabled={!form.value.trim()}
                style={{ marginTop: 12, background: theme.primary, color: "#FBF9F4", border: "none", borderRadius: 10, padding: "9px 18px", fontSize: "0.85rem", cursor: "pointer", opacity: form.value.trim() ? 1 : 0.5 }}
              >
                شامل کریں
              </button>
            </div>
          )}
        </section>

        <section style={sectionStyle}>
          <h2 style={{ fontFamily: "'Noto Nastaliq Urdu', serif", fontSize: "1.05rem", color: theme.primary, margin: "0 0 12px" }}>
            موجودہ Contacts
          </h2>
          <div style={{ display: "grid", gap: 10 }}>
            {draftContacts.length === 0 && (
              <p style={{ fontSize: "0.85rem", color: theme.textMuted, textAlign: "center", margin: 0 }}>ابھی کوئی contact شامل نہیں۔</p>
            )}
            {draftContacts.map((c) => {
              const Icon = c.type === "phone" ? Phone : Mail;
              return (
                <div key={c.id} style={{ border: `1px solid ${theme.border}`, borderRadius: 12, padding: 12, background: "#FDFCF9" }}>
                  {editingId === c.id ? (
                    <div>
                      {ContactFormFields({ f: editForm, setF: setEditForm })}
                      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                        <button onClick={() => saveEdit(c.id)} style={{ background: theme.primary, color: "#FBF9F4", border: "none", borderRadius: 9, padding: "7px 14px", fontSize: "0.8rem", cursor: "pointer" }}>
                          محفوظ کریں
                        </button>
                        <button onClick={() => setEditingId(null)} style={{ background: "#fff", border: `1px solid ${theme.border}`, color: theme.textMuted, borderRadius: 9, padding: "7px 14px", fontSize: "0.8rem", cursor: "pointer" }}>
                          منسوخ
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <div style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(11,79,63,0.08)", display: "flex", alignItems: "center", justifyContent: "center", color: theme.primary, flexShrink: 0 }}>
                        <Icon size={17} />
                      </div>
                      <div style={{ flex: "1 1 160px", minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 700, direction: "ltr" }}>{c.value}</span>
                          {c.label && <span style={{ fontSize: "0.72rem", color: theme.textMuted }}>({c.label})</span>}
                          {c.status === "archived" && (
                            <span style={{ background: "rgba(91,107,98,0.14)", color: theme.textMuted, borderRadius: 999, padding: "2px 9px", fontSize: "0.68rem" }}>غیر فعال</span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button onClick={() => startEdit(c)} style={{ border: `1px solid ${theme.border}`, background: "#fff", color: theme.primary, borderRadius: 999, padding: "5px 11px", fontSize: "0.72rem", cursor: "pointer" }}>
                          ترمیم
                        </button>
                        <button onClick={() => toggleStatus(c.id)} style={{ border: "none", background: c.status === "active" ? "rgba(91,107,98,0.14)" : "rgba(11,79,63,0.1)", color: c.status === "active" ? theme.textMuted : theme.primary, borderRadius: 999, padding: "5px 11px", fontSize: "0.72rem", cursor: "pointer" }}>
                          {c.status === "active" ? "غیر فعال کریں" : "فعال کریں"}
                        </button>
                        <button onClick={() => removeContact(c.id)} style={{ border: "none", background: "rgba(178,52,52,0.1)", color: "#B23434", borderRadius: 999, padding: "5px 11px", fontSize: "0.72rem", cursor: "pointer" }}>
                          حذف کریں
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <div style={{ position: "fixed", bottom: 0, insetInlineStart: 0, insetInlineEnd: 0, background: "#FFFFFF", borderTop: `1px solid ${theme.border}`, padding: "12px 16px", display: "flex", justifyContent: "center", gap: 12, boxShadow: "0 -6px 16px rgba(31,42,36,0.08)", zIndex: 25 }}>
        {savedFlash && (
          <span style={{ display: "flex", alignItems: "center", gap: 6, color: theme.primary, fontSize: "0.85rem", alignSelf: "center" }}>
            <CheckCircle2 size={16} /> تبدیلیاں کامیابی سے محفوظ ہوگئیں
          </span>
        )}
        <button
          onClick={handleSave}
          style={{ display: "flex", alignItems: "center", gap: 8, background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryDark} 100%)`, color: "#FBF9F4", border: "none", borderRadius: 12, padding: "12px 28px", fontSize: "0.95rem", fontFamily: "'Noto Naskh Arabic', serif", cursor: "pointer", boxShadow: "0 6px 16px rgba(11,79,63,0.28)" }}
        >
          <Save size={17} />
          تبدیلیاں محفوظ کریں
        </button>
      </div>
    </div>
  );
}
