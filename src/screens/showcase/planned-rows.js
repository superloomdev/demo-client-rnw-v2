// Info: The roster's future: the nine M9 Mobile rows the library does not
// list yet, in the catalog's own row shape, and the milestone each family
// belongs to. A pending row shows its family's milestone on the showcase.


// The planned M9 rows, in this order
export const PLANNED_ROWS = [
  { name: 'BottomNavigationBar', family: 'Mobile', tier: 'composite', platform: { support: 'all', fallback: 'none' }, carbon_twin: 'none', material_twin: 'none', status: 'pending', description: 'Carbon Mobile bottom navigation bar, three to five destinations' },
  { name: 'TopNavigationBar', family: 'Mobile', tier: 'composite', platform: { support: 'all', fallback: 'none' }, carbon_twin: 'none', material_twin: 'none', status: 'pending', description: 'Carbon Mobile top navigation bar with title, back and actions' },
  { name: 'BottomToolbar', family: 'Mobile', tier: 'composite', platform: { support: 'all', fallback: 'none' }, carbon_twin: 'none', material_twin: 'none', status: 'pending', description: 'Carbon Mobile bottom toolbar of actions' },
  { name: 'BottomToolbarPrimaryAction', family: 'Mobile', tier: 'composite', platform: { support: 'all', fallback: 'none' }, carbon_twin: 'none', material_twin: 'none', status: 'pending', description: 'Bottom toolbar with one raised primary action' },
  { name: 'ActionSheet', family: 'Mobile', tier: 'composite', platform: { support: 'all', fallback: 'none' }, carbon_twin: 'none', material_twin: 'none', status: 'pending', description: 'Action sheet - drawn on web and Android, the OS sheet on iOS' },
  { name: 'UiPanel', family: 'Mobile', tier: 'composite', platform: { support: 'all', fallback: 'none' }, carbon_twin: 'none', material_twin: 'none', status: 'pending', description: 'Carbon Mobile side panel' },
  { name: 'UiPanelItem', family: 'Mobile', tier: 'composite', platform: { support: 'all', fallback: 'none' }, carbon_twin: 'none', material_twin: 'none', status: 'pending', description: 'One item of a UiPanel' },
  { name: 'NavigationList', family: 'Mobile', tier: 'composite', platform: { support: 'all', fallback: 'none' }, carbon_twin: 'none', material_twin: 'none', status: 'pending', description: 'Carbon Mobile navigation list' },
  { name: 'NavigationListItem', family: 'Mobile', tier: 'composite', platform: { support: 'all', fallback: 'none' }, carbon_twin: 'none', material_twin: 'none', status: 'pending', description: 'One item of a NavigationList' }
];


// Family to milestone: a pending row's milestone is its family's
export const MILESTONES = {
  Select: 'M5',
  Tag: 'M5',
  Tooltip: 'M5',
  FloatingActionButton: 'M5',
  Popover: 'M5',
  Tabs: 'M5',
  Menu: 'M5',
  Modal: 'M5',
  Notification: 'M5',
  Accordion: 'M5',
  Breadcrumb: 'M5',
  List: 'M5',
  ContainedList: 'M5',
  Copy: 'M5',
  SkipToContent: 'M5',
  Tile: 'M6',
  Pagination: 'M6',
  Grid: 'M6',
  TreeView: 'M6',
  Card: 'M6',
  EmptyState: 'M6',
  PageHeader: 'M6',
  Tearsheet: 'M6',
  DatePicker: 'M6',
  FileUploader: 'M6',
  Header: 'M7',
  Navigation: 'M7',
  StructuredList: 'M7',
  DataTable: 'M8',
  Mobile: 'M9'
};
