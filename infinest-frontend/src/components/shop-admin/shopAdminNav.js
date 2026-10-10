import {
  Users, Phone, TrendingUp, Truck, DollarSign, CheckCircle, AlertCircle, UserPlus, Briefcase,
  ClipboardList, FileText, Wallet, Calculator, Building2, Boxes, History, CreditCard, Store, Send,
  BarChart3, Award, Package,
} from 'lucide-react';

// Shop-admin navigation shared by the desktop sidebar and the mobile dashboard.
// `product` decides visibility from the shop's plan: 'service', 'sales' or undefined (always shown).
// `desc` is only used by the mobile hub tiles.
export const NAV = [
  { type: 'item', id: 'overview', label: 'Overview', icon: TrendingUp },
  { type: 'item', id: 'business-analytics', label: 'Business Analytics', icon: BarChart3, desc: 'Sales + service P&L' },
  {
    type: 'group', key: 'hr', label: 'HR', icon: Users, children: [
      { id: 'hr-employees', label: 'Employees', icon: Users, desc: 'Add, edit & manage staff' },
      { id: 'hr-attendance', label: 'Attendance', icon: CheckCircle, desc: 'Daily register & leaves' },
      { id: 'salary', label: 'Salary', icon: DollarSign, desc: 'Payroll & incentives' },
      { id: 'hr-performance', label: 'Performance', icon: Award, desc: 'Sales & service by staff' },
    ]
  },
  { type: 'heading', key: 'heading-service', label: 'Service', product: 'service' },
  {
    type: 'group', key: 'records', label: 'Records', icon: ClipboardList, product: 'service', children: [
      { id: 'all-records', label: 'All Records', icon: Phone, desc: 'Customer & dealer jobs' },
      { id: 'customer-create', label: 'Create Customer', icon: UserPlus, desc: 'New customer record' },
      { id: 'dealer-create', label: 'Create Dealer', icon: Briefcase, desc: 'New dealer record' },
    ]
  },
  {
    type: 'group', key: 'suppliers', label: 'Suppliers', icon: Truck, product: 'service', children: [
      { id: 'suppliers', label: 'Manage Suppliers', icon: Truck, desc: 'Spare-part suppliers' },
    ]
  },
  {
    type: 'group', key: 'reports', label: 'Reports', icon: FileText, product: 'service', children: [
      { id: 'revenue', label: 'Revenue', icon: DollarSign, desc: 'Income, expenses & profit' },
      { id: 'report', label: 'Financial Report', icon: AlertCircle, desc: 'Printable / Excel report' },
    ]
  },
  { type: 'heading', key: 'heading-sales', label: 'Sales', product: 'sales' },
  {
    type: 'group', key: 'sales-finance', label: 'Financial', icon: Wallet, product: 'sales', children: [
      { id: 'sales-expenses', label: 'Expenses', icon: Wallet, desc: 'Branch expenses & costs' },
      { id: 'sales-gst', label: 'GST Calculator', icon: Calculator, desc: 'GST on purchases & sales' },
    ]
  },
  {
    type: 'group', key: 'sales-inventory', label: 'Inventory', icon: Boxes, product: 'sales', children: [
      { id: 'sales-dealers', label: 'Dealers', icon: Building2, desc: 'Suppliers & vendors' },
      { id: 'sales-inventory', label: 'Product Inventory', icon: Package, desc: 'Master stock & imports' },
      { id: 'sales-stock-history', label: 'Stock History', icon: History, desc: 'Stock sent over time' },
      { id: 'sales-supplier-credits', label: 'Supplier Credits', icon: CreditCard, desc: 'Credit accounts & dues' },
    ]
  },
  {
    type: 'group', key: 'sales-branches', label: 'Branch Operations', icon: Store, product: 'sales', children: [
      { id: 'sales-branches', label: 'Branch Management', icon: Store, desc: 'Create & manage branches' },
      { id: 'sales-branch-supply', label: 'Branch Supply', icon: Send, desc: 'Send stock to branches' },
      { id: 'sales-supply-history', label: 'Supply History', icon: ClipboardList, desc: 'All supplies sent' },
      { id: 'sales-branch-sales', label: 'Branch Sales', icon: BarChart3, desc: 'Sales across branches' },
    ]
  },
];

// Which nav nodes the shop's plan unlocks; headings only make sense when both products are present
export function buildVisibleNav(access) {
  if (!access) return [];
  const both = access.service && access.sales;
  return NAV.filter((node) => {
    if (node.type === 'heading') return both && access[node.product];
    return !node.product || access[node.product];
  });
}

export const ALWAYS_TABS = ['overview', 'business-analytics', 'employees', 'hr-employees', 'hr-attendance', 'salary', 'hr-performance'];

export function isTabAllowed(tab, visibleNav) {
  if (ALWAYS_TABS.includes(tab)) return true;
  return visibleNav.some((node) =>
    node.type === 'item' ? node.id === tab : node.type === 'group' && node.children.some((c) => c.id === tab)
  );
}

// Finds the nav entry (item or group child) for a tab id, with the group it belongs to
export function findNavEntry(tab) {
  for (const node of NAV) {
    if (node.type === 'item' && node.id === tab) return { entry: node, group: null };
    if (node.type === 'group') {
      const child = node.children.find((c) => c.id === tab);
      if (child) return { entry: child, group: node };
    }
  }
  return null;
}
