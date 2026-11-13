import React, { createContext, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";

export type AppLanguage = "en" | "es";

export interface Translations {
  // Navigation & Shell
  dashboard: string;
  finances: string;
  wishes: string;
  doos: string;
  settings: string;
  signOut: string;
  welcomeBack: string;
  overview: string;
  workspaceModules: string;
  switchModule: string;
  allSettingsAndSecurity: string;

  // Settings Screen
  profileAndSettingsTitle: string;
  profileAndSettingsSubtitle: string;
  profileInfo: string;
  emailAddress: string;
  emailNote: string;
  displayName: string;
  saveProfile: string;
  saving: string;
  profileSaved: string;

  // Language section
  languageTitle: string;
  languageSubtitle: string;
  english: string;
  spanish: string;
  englishDesc: string;
  spanishDesc: string;

  // Appearance & Theme
  appearanceAndTheme: string;
  themeStyleTitle: string;
  classical: string;
  classicalDesc: string;
  pastel: string;
  pastelDesc: string;
  joyful: string;
  joyfulDesc: string;
  colorModeTitle: string;
  lightMode: string;
  darkMode: string;

  // Workspace & Currency
  workspaceAndCurrency: string;
  workspaceNameLabel: string;
  currencyLabel: string;
  saveWorkspace: string;
  workspaceSaved: string;

  // Security & Password
  securityAndPassword: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  updatePassword: string;
  passwordUpdated: string;

  // Active Sessions
  activeSessions: string;
  revokeAllOtherSessions: string;
  currentSessionBadge: string;
  activeNow: string;

  // Finances Module
  financesOverviewTitle: string;
  financesOverviewSubtitle: string;
  totalNetBalance: string;
  liquidReservesSubtitle: string;
  monthlyCashflow: string;
  incomeLabel: string;
  expenseLabel: string;
  netSavingsRate: string;
  logTransaction: string;
  addWallet: string;
  newTransaction: string;
  transactionsTab: string;
  budgetsTab: string;
  savingsTab: string;
  accountsTab: string;
  all: string;
  expense: string;
  income: string;
  transfer: string;
  noTransactionsYet: string;
  tapToRecord: string;
  editTransaction: string;
  deleteTransaction: string;
  deleteConfirmTitle: string;
  deleteConfirmDesc: string;
  cancel: string;
  delete: string;
  amount: string;
  description: string;
  account: string;
  category: string;
  transactionDate: string;
  saveAndConfirmTransaction: string;
  transactionConfirmed: string;
  transactionUpdated: string;
  transactionDeleted: string;
  accountsCount: string;
  setBudget: string;
  monthlyCategoryLimits: string;
  period: string;
  spent: string;
  limit: string;
  newGoal: string;
  activeSavingsGoals: string;
  savedToward: string;
  target: string;
  transferFundGoal: string;
  addAccount: string;
  connectedWalletsAndAccounts: string;
  activeAccountsCount: string;
  currentBalance: string;

  // Wishes Module
  wishesTitle: string;
  wishesSubtitle: string;
  newWish: string;
  addWish: string;
  allWishes: string;
  activeWishes: string;
  grantedWishes: string;
  grantWish: string;
  editWish: string;
  deleteWish: string;
  deleteWishConfirmTitle: string;
  deleteWishConfirmDesc: string;
  wishlistAspirations: string;
  totalEstimatedValue: string;
  highPriority: string;
  mediumPriority: string;
  lowPriority: string;
  noWishesFound: string;
  noWishesDesc: string;
  noWishesFilterDesc: string;
  addFirstWish: string;
  active: string;
  granted: string;
  grant: string;
  linkToAccount: string;
  linkToSavingsGoal: string;
  linkToDoos: string;
  noLinkedAccount: string;
  noLinkedGoal: string;
  noLinkedTasks: string;

  // DOOs (Tasks) Module
  doosTitle: string;
  doosSubtitle: string;
  myTasks: string;
  newTask: string;
  allTasks: string;
  today: string;
  upcoming: string;
  completed: string;
  dueToday: string;
  subtasks: string;
  priorityHigh: string;
  priorityMedium: string;
  priorityLow: string;
  deleteDooConfirmTitle: string;
  deleteDooConfirmDesc: string;
  doosActionItems: string;
  doosHeroSubtitle: string;
  pending: string;
  done: string;
  allDoos: string;
  noTasksFound: string;
  noTasksDesc: string;
  noTasksFilterDesc: string;
  addFirstDoo: string;
  saveChanges: string;
  saveAndConfirmDoo: string;

  // Common UI
  save: string;
  confirm: string;
  saveAndConfirm: string;
  edit: string;
  undo: string;
  loading: string;
  actions: string;
}

const TRANSLATIONS_EN: Translations = {
  // Navigation & Shell
  dashboard: "Dashboard",
  finances: "Finances",
  wishes: "Wishes",
  doos: "DOOs",
  settings: "Settings",
  signOut: "Sign Out",
  welcomeBack: "Welcome back",
  overview: "Overview",
  workspaceModules: "Workspace Modules",
  switchModule: "Switch Module",
  allSettingsAndSecurity: "All Settings & Security",

  // Settings Screen
  profileAndSettingsTitle: "Profile & Settings",
  profileAndSettingsSubtitle: "Manage your profile, language, theme appearance, workspace currency, and active security sessions.",
  profileInfo: "Profile Information",
  emailAddress: "Email Address",
  emailNote: "Primary email address is managed at account creation.",
  displayName: "Display Name",
  saveProfile: "Save Profile",
  saving: "Saving...",
  profileSaved: "Profile updated successfully.",

  // Language section
  languageTitle: "Language / Idioma",
  languageSubtitle: "Choose your preferred display language.",
  english: "English",
  spanish: "Español",
  englishDesc: "English interface",
  spanishDesc: "Interfaz en español",

  // Appearance & Theme
  appearanceAndTheme: "Appearance & Theme",
  themeStyleTitle: "Theme Style (3 Minimalist Variants)",
  classical: "Classical",
  classicalDesc: "Monochrome & Slate",
  pastel: "Pastel",
  pastelDesc: "Soft Sage & Lilac",
  joyful: "Joyful",
  joyfulDesc: "Warm Amber & Sunset",
  colorModeTitle: "Color Mode",
  lightMode: "Light",
  darkMode: "Dark",

  // Workspace & Currency
  workspaceAndCurrency: "Workspace & Currency",
  workspaceNameLabel: "Workspace Name",
  currencyLabel: "Currency Code (ISO-4217)",
  saveWorkspace: "Save Workspace Settings",
  workspaceSaved: "Workspace settings updated.",

  // Security & Password
  securityAndPassword: "Security & Password",
  currentPassword: "Current Password",
  newPassword: "New Password (8+ characters)",
  confirmPassword: "Confirm New Password",
  updatePassword: "Update Password",
  passwordUpdated: "Password updated successfully.",

  // Active Sessions
  activeSessions: "Active Sessions & Devices",
  revokeAllOtherSessions: "Revoke Other Sessions",
  currentSessionBadge: "Current Session",
  activeNow: "Active now",

  // Finances Module
  financesOverviewTitle: "Finances & Cashflow",
  financesOverviewSubtitle: "Track multiple accounts, budgets, and savings goals with double-entry atomicity.",
  totalNetBalance: "Total Net Balance",
  liquidReservesSubtitle: "Available liquid assets and reserves across all wallets",
  monthlyCashflow: "Cashflow (This Month)",
  incomeLabel: "Income",
  expenseLabel: "Expenses",
  netSavingsRate: "Net Savings Rate",
  logTransaction: "+ Log Transaction",
  addWallet: "+ Add Wallet",
  newTransaction: "+ New Transaction",
  transactionsTab: "Transactions",
  budgetsTab: "Budgets",
  savingsTab: "Savings Goals",
  accountsTab: "Accounts",
  all: "All",
  expense: "Expense",
  income: "Income",
  transfer: "Transfer",
  noTransactionsYet: "No transactions logged yet",
  tapToRecord: 'Tap "+ New Transaction" to record an expense, income, or transfer.',
  editTransaction: "Edit Transaction",
  deleteTransaction: "Delete Transaction",
  deleteConfirmTitle: "Delete Transaction?",
  deleteConfirmDesc: "Are you sure you want to delete this transaction? You can undo this action immediately after.",
  cancel: "Cancel",
  delete: "Delete",
  amount: "AMOUNT",
  description: "DESCRIPTION",
  account: "ACCOUNT",
  category: "CATEGORY",
  transactionDate: "TRANSACTION DATE",
  saveAndConfirmTransaction: "Save & Confirm Transaction",
  transactionConfirmed: "Transaction confirmed",
  transactionUpdated: "Updated transaction",
  transactionDeleted: "Deleted transaction",
  accountsCount: "Accounts",
  setBudget: "+ Set Budget",
  monthlyCategoryLimits: "Monthly Category Limits",
  period: "Period",
  spent: "Spent",
  limit: "Limit",
  newGoal: "+ New Goal",
  activeSavingsGoals: "Active Savings Goals",
  savedToward: "saved toward",
  target: "Target",
  transferFundGoal: "Transfer / Fund Goal",
  addAccount: "+ Add Account",
  connectedWalletsAndAccounts: "Connected Wallets & Accounts",
  activeAccountsCount: "active accounts",
  currentBalance: "Current Balance",

  // Wishes Module
  wishesTitle: "Wishes & Catalog",
  wishesSubtitle: "Save and curate products you wish to acquire, track their funding, and fulfill them cleanly.",
  newWish: "+ New Wish",
  addWish: "Add Wish",
  allWishes: "All Wishes",
  activeWishes: "Active",
  grantedWishes: "Granted",
  grantWish: "Fulfill & Deduct",
  editWish: "Edit Wish",
  deleteWish: "Delete Wish",
  deleteWishConfirmTitle: "Delete Wish?",
  deleteWishConfirmDesc: "Are you sure you want to delete this wish? You can undo this action immediately after.",
  wishlistAspirations: "Wishlist & Aspirations",
  totalEstimatedValue: "Total estimated value of active wishes in this workspace.",
  highPriority: "High Priority",
  mediumPriority: "Medium Priority",
  lowPriority: "Low Priority",
  noWishesFound: "No wishes found",
  noWishesDesc: "Add your first wish to start tracking estimated costs, linked funds, and tasks.",
  noWishesFilterDesc: "Try clearing your filters to see more wishes.",
  addFirstWish: "Add Your First Wish",
  active: "Active",
  granted: "Granted",
  grant: "Grant",
  linkToAccount: "Link to Account (Optional)",
  linkToSavingsGoal: "Link to Savings Goal (Optional)",
  linkToDoos: "Link Action Steps (DOOs)",
  noLinkedAccount: "None (No Account)",
  noLinkedGoal: "None (No Goal)",
  noLinkedTasks: "None (Standalone)",

  // DOOs (Tasks) Module
  doosTitle: "DOOs & Tasks",
  doosSubtitle: "Organize actions, subtasks, deadlines, and wish linkings with explicit confirmation.",
  myTasks: "My DOOs (Tasks)",
  newTask: "+ New DOO",
  allTasks: "All",
  today: "Today",
  upcoming: "Upcoming",
  completed: "Completed",
  dueToday: "Due Today",
  subtasks: "Subtasks",
  priorityHigh: "High",
  priorityMedium: "Medium",
  priorityLow: "Low",
  deleteDooConfirmTitle: "Delete DOO?",
  deleteDooConfirmDesc: "Are you sure you want to delete this task? You can undo this action immediately after.",
  doosActionItems: "DOOs & Action Items",
  doosHeroSubtitle: "Actionable milestones, recurring habits, and steps linked directly to your Wishes.",
  pending: "Pending",
  done: "Done",
  allDoos: "All DOOs",
  noTasksFound: "No tasks found",
  noTasksDesc: "You haven't created any tasks yet. Break down your goals into actionable milestones!",
  noTasksFilterDesc: "No tasks match the selected filter. Try switching to 'All DOOs'.",
  addFirstDoo: "+ Add Your First DOO",
  saveChanges: "Save Changes",
  saveAndConfirmDoo: "Save & Confirm DOO",

  // Common UI
  save: "Save",
  confirm: "Confirm",
  saveAndConfirm: "Save & Confirm",
  edit: "Edit",
  undo: "Undo",
  loading: "Loading...",
  actions: "Actions",
};

const TRANSLATIONS_ES: Translations = {
  // Navigation & Shell
  dashboard: "Panel",
  finances: "Finanzas",
  wishes: "Deseos",
  doos: "DOOs (Tareas)",
  settings: "Ajustes",
  signOut: "Cerrar Sesión",
  welcomeBack: "Bienvenido de nuevo",
  overview: "Resumen",
  workspaceModules: "Módulos de Espacio",
  switchModule: "Cambiar Módulo",
  allSettingsAndSecurity: "Todos los Ajustes y Seguridad",

  // Settings Screen
  profileAndSettingsTitle: "Perfil y Ajustes",
  profileAndSettingsSubtitle: "Administra tu perfil, idioma, apariencia visual, moneda del espacio y sesiones activas.",
  profileInfo: "Información del Perfil",
  emailAddress: "Correo Electrónico",
  emailNote: "El correo principal se administra en la creación de la cuenta.",
  displayName: "Nombre Visible",
  saveProfile: "Guardar Perfil",
  saving: "Guardando...",
  profileSaved: "Perfil actualizado correctamente.",

  // Language section
  languageTitle: "Idioma / Language",
  languageSubtitle: "Elige tu idioma preferido para la aplicación.",
  english: "English",
  spanish: "Español",
  englishDesc: "English interface",
  spanishDesc: "Interfaz en español",

  // Appearance & Theme
  appearanceAndTheme: "Apariencia y Tema",
  themeStyleTitle: "Estilo Visual (3 Variantes Minimalistas)",
  classical: "Clásico",
  classicalDesc: "Monocromo y Pizarra",
  pastel: "Pastel",
  pastelDesc: "Salvia Suave y Lila",
  joyful: "Alegre",
  joyfulDesc: "Ámbar Cálido y Atardecer",
  colorModeTitle: "Modo de Color",
  lightMode: "Claro",
  darkMode: "Oscuro",

  // Workspace & Currency
  workspaceAndCurrency: "Espacio de Trabajo y Moneda",
  workspaceNameLabel: "Nombre del Espacio",
  currencyLabel: "Código de Moneda (ISO-4217)",
  saveWorkspace: "Guardar Ajustes de Espacio",
  workspaceSaved: "Ajustes de espacio actualizados.",

  // Security & Password
  securityAndPassword: "Seguridad y Contraseña",
  currentPassword: "Contraseña Actual",
  newPassword: "Nueva Contraseña (8+ caracteres)",
  confirmPassword: "Confirmar Nueva Contraseña",
  updatePassword: "Actualizar Contraseña",
  passwordUpdated: "Contraseña actualizada con éxito.",

  // Active Sessions
  activeSessions: "Sesiones y Dispositivos Activos",
  revokeAllOtherSessions: "Cerrar Otras Sesiones",
  currentSessionBadge: "Sesión Actual",
  activeNow: "Activa ahora",

  // Finances Module
  financesOverviewTitle: "Finanzas y Flujo de Caja",
  financesOverviewSubtitle: "Gestiona múltiples cuentas, presupuestos y metas de ahorro con atomicidad contable.",
  totalNetBalance: "Balance Neto Total",
  liquidReservesSubtitle: "Fondos y reservas líquidas disponibles en todas las billeteras",
  monthlyCashflow: "Flujo de Caja Mensual",
  incomeLabel: "Ingresos",
  expenseLabel: "Gastos",
  netSavingsRate: "Tasa de Ahorro Neto",
  logTransaction: "+ Registrar Transacción",
  addWallet: "+ Agregar Billetera",
  newTransaction: "+ Nueva Transacción",
  transactionsTab: "Transacciones",
  budgetsTab: "Presupuestos",
  savingsTab: "Ahorros",
  accountsTab: "Cuentas",
  all: "Todos",
  expense: "Gasto",
  income: "Ingreso",
  transfer: "Transferencia",
  noTransactionsYet: "Aún no hay transacciones registradas",
  tapToRecord: 'Toca "+ Nueva Transacción" para registrar un gasto, ingreso o transferencia.',
  editTransaction: "Editar Transacción",
  deleteTransaction: "Eliminar Transacción",
  deleteConfirmTitle: "¿Eliminar Transacción?",
  deleteConfirmDesc: "¿Seguro que deseas eliminar esta transacción? Podrás deshacer la acción inmediatamente después.",
  cancel: "Cancelar",
  delete: "Eliminar",
  amount: "MONTO",
  description: "DESCRIPCIÓN",
  account: "CUENTA",
  category: "CATEGORÍA",
  transactionDate: "FECHA DE TRANSACCIÓN",
  saveAndConfirmTransaction: "Guardar y Confirmar Transacción",
  transactionConfirmed: "Transacción confirmada",
  transactionUpdated: "Transacción actualizada",
  transactionDeleted: "Transacción eliminada",
  accountsCount: "Cuentas",
  setBudget: "+ Definir Presupuesto",
  monthlyCategoryLimits: "Límites Mensuales por Categoría",
  period: "Período",
  spent: "Gastado",
  limit: "Límite",
  newGoal: "+ Nueva Meta",
  activeSavingsGoals: "Metas de Ahorro Activas",
  savedToward: "ahorrado de",
  target: "Meta",
  transferFundGoal: "Transferir / Fondear Meta",
  addAccount: "+ Agregar Cuenta",
  connectedWalletsAndAccounts: "Billeteras y Cuentas Conectadas",
  activeAccountsCount: "cuentas activas",
  currentBalance: "Saldo Actual",

  // Wishes Module
  wishesTitle: "Deseos y Catálogo",
  wishesSubtitle: "Guarda productos que deseas adquirir, planifica sus fondos y cúmplelos sin sorpresas.",
  newWish: "+ Nuevo Deseo",
  addWish: "Agregar Deseo",
  allWishes: "Todos los Deseos",
  activeWishes: "Activos",
  grantedWishes: "Cumplidos",
  grantWish: "Cumplir y Deducir",
  editWish: "Editar Deseo",
  deleteWish: "Eliminar Deseo",
  deleteWishConfirmTitle: "¿Eliminar Deseo?",
  deleteWishConfirmDesc: "¿Seguro que deseas eliminar este deseo? Podrás deshacer la acción inmediatamente después.",
  wishlistAspirations: "Lista de Deseos y Aspiraciones",
  totalEstimatedValue: "Valor total estimado de deseos activos en este espacio.",
  highPriority: "Prioridad Alta",
  mediumPriority: "Prioridad Media",
  lowPriority: "Prioridad Baja",
  noWishesFound: "No se encontraron deseos",
  noWishesDesc: "Agrega tu primer deseo para comenzar a proyectar costos, fondos y tareas asociadas.",
  noWishesFilterDesc: "Intenta limpiar tus filtros para ver más deseos.",
  addFirstWish: "Agrega Tu Primer Deseo",
  active: "Activo",
  granted: "Cumplido",
  grant: "Cumplir",
  linkToAccount: "Vincular a Cuenta (Opcional)",
  linkToSavingsGoal: "Vincular a Meta de Ahorro (Opcional)",
  linkToDoos: "Vincular Pasos de Acción (DOOs)",
  noLinkedAccount: "Ninguna (Sin Cuenta)",
  noLinkedGoal: "Ninguna (Sin Meta)",
  noLinkedTasks: "Ninguna (Independiente)",

  // DOOs (Tasks) Module
  doosTitle: "DOOs y Tareas",
  doosSubtitle: "Organiza acciones, subtareas, fechas de entrega y vinculación con deseos.",
  myTasks: "Mis DOOs (Tareas)",
  newTask: "+ Nueva Tarea",
  allTasks: "Todas",
  today: "Hoy",
  upcoming: "Próximas",
  completed: "Completadas",
  dueToday: "Vence Hoy",
  subtasks: "Subtareas",
  priorityHigh: "Alta",
  priorityMedium: "Media",
  priorityLow: "Baja",
  deleteDooConfirmTitle: "¿Eliminar Tarea?",
  deleteDooConfirmDesc: "¿Seguro que deseas eliminar esta tarea? Podrás deshacer la acción inmediatamente después.",
  doosActionItems: "DOOs y Acciones",
  doosHeroSubtitle: "Hitos concretos, hábitos recurrentes y pasos vinculados a tus deseos.",
  pending: "Pendientes",
  done: "Completadas",
  allDoos: "Todos los DOOs",
  noTasksFound: "No se encontraron tareas",
  noTasksDesc: "Aún no has creado ninguna tarea. ¡Convierte tus metas en pasos accionables!",
  noTasksFilterDesc: "No hay tareas que coincidan con el filtro seleccionado. Prueba 'Todos los DOOs'.",
  addFirstDoo: "+ Agrega Tu Primer DOO",
  saveChanges: "Guardar Cambios",
  saveAndConfirmDoo: "Guardar y Confirmar DOO",

  // Common UI
  save: "Guardar",
  confirm: "Confirmar",
  saveAndConfirm: "Guardar y Confirmar",
  edit: "Editar",
  undo: "Deshacer",
  loading: "Cargando...",
  actions: "Acciones",
};

const LANGUAGE_STORAGE_KEY = "wad_preferred_language_v1";

interface LanguageContextValue {
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

function getInitialLanguage(): AppLanguage {
  if (Platform.OS === "web" && typeof window !== "undefined" && window.localStorage) {
    try {
      const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (stored === "en" || stored === "es") {
        return stored;
      }
      const navLang = window.navigator?.language?.toLowerCase() || "";
      if (navLang.startsWith("es")) {
        return "es";
      }
    } catch {}
  }
  return "en";
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(getInitialLanguage);

  const setLanguage = (lang: AppLanguage) => {
    setLanguageState(lang);
    if (Platform.OS === "web" && typeof window !== "undefined" && window.localStorage) {
      try {
        window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
      } catch {}
    }
  };

  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined" && document.documentElement) {
      document.documentElement.lang = language;
    }
  }, [language]);

  const t = language === "es" ? TRANSLATIONS_ES : TRANSLATIONS_EN;

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    return {
      language: "en",
      setLanguage: () => {},
      t: TRANSLATIONS_EN,
    };
  }
  return ctx;
}
