// Info: Sample screen - records. A searchable, filterable, paged list
// composed only of built components: Search narrows by title,
// SelectableTags filter by status, each row carries a status Tag, a
// ProgressBar and an overflow Menu, a title press opens the record's
// Modal, and ButtonSet pages the list since Pagination is not built yet.
import { useLib } from '../../app-core/contexts/lib-context.js';
import Scene from '../Scene.js';


// Twelve fixed records the screen filters and pages
const RECORDS = [
  { title: 'Atlas migration', owner: 'Chen', updated: '2026-10-21', status: 'open', percent: 80 },
  { title: 'Billing export', owner: 'Rivera', updated: '2026-10-20', status: 'blocked', percent: 35 },
  { title: 'Crash triage', owner: 'Osei', updated: '2026-10-19', status: 'open', percent: 60 },
  { title: 'Dark theme audit', owner: 'Chen', updated: '2026-10-18', status: 'closed', percent: 100 },
  { title: 'Edge cache', owner: 'Kim', updated: '2026-10-17', status: 'open', percent: 45 },
  { title: 'Failover drill', owner: 'Osei', updated: '2026-10-16', status: 'blocked', percent: 20 },
  { title: 'Gateway rollout', owner: 'Rivera', updated: '2026-10-15', status: 'closed', percent: 100 },
  { title: 'Health checks', owner: 'Kim', updated: '2026-10-14', status: 'open', percent: 55 },
  { title: 'Index rebuild', owner: 'Chen', updated: '2026-10-13', status: 'open', percent: 70 },
  { title: 'Joiner table', owner: 'Rivera', updated: '2026-10-12', status: 'blocked', percent: 10 },
  { title: 'Kernel update', owner: 'Osei', updated: '2026-10-11', status: 'closed', percent: 100 },
  { title: 'Latency budget', owner: 'Kim', updated: '2026-10-10', status: 'open', percent: 90 }
];

const PAGE_SIZE = 5;
const STATUSES = ['open', 'closed', 'blocked'];
const MENU_ITEMS = [{ label: 'Open' }, { label: 'Duplicate' }, { divider: true }, { label: 'Archive' }];


export default function Records () {

  // Init the container and the theme controller
  const Lib = useLib();
  const React = Lib.React;
  const { View } = Lib.ReactNative;
  const ctx = Lib.ThemeContext.useThemeController();
  const R = ctx.Registry;

  // The filter, page, menu and dialog state
  const [query, setQuery] = React.useState('');
  const [statuses, setStatuses] = React.useState([]);
  const [page, setPage] = React.useState(0);
  const [menu, setMenu] = React.useState(null); // { index, x, y }
  const [detail, setDetail] = React.useState(null);

  // The filtered and paged slice
  const filtered = RECORDS.filter(function (record) {
    const matchesQuery = Lib.Utils.isEmptyString(query) || record.title.toLowerCase().indexOf(query.toLowerCase()) !== -1;
    const matchesStatus = Lib.Utils.isEmptyArray(statuses) || statuses.indexOf(record.status) !== -1;
    return matchesQuery && matchesStatus;
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const visible = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  // A status tag press toggles its filter and returns to the first page
  const toggleStatus = function (status) {
    return function () {
      setStatuses(function (list) {
        return list.indexOf(status) === -1 ? list.concat([status]) : list.filter(function (item) {
          return item !== status;
        });
      });
      setPage(0);
    };
  };

  // The overflow button anchors its menu at the measured row position
  const anchors = React.useRef({});
  const openMenu = function (index) {
    return function () {
      const node = anchors.current[index];
      if (node && node.measureInWindow) {
        node.measureInWindow(function (x, y, width, height) {
          setMenu({ index: index, x: x + width, y: y + height });
        });
      } else {
        setMenu({ index: index, x: 0, y: 0 });
      }
    };
  };

  // An opened menu takes the focus so Escape and the arrows reach it. The
  // layer host mounts the surface passes after the trigger's set state, so
  // the focus lands when the first menuitem exists, not at a fixed delay.
  React.useEffect(function () {
    if (menu === null || typeof document === 'undefined') {
      return undefined;
    }
    let attempts = 0;
    const timer = setInterval(function () {
      attempts += 1;
      const surface = document.querySelector('[role="menu"] [role="menuitem"]');
      if (surface && surface.focus) {
        surface.focus();
        clearInterval(timer);
      } else if (attempts > 30) {
        clearInterval(timer);
      }
    }, 16);
    return function () {
      clearInterval(timer);
    };
  }, [menu]);

  // Render the list inside the route's own scene
  return React.createElement(Scene, { testID: 'sample-records' },
    React.createElement(Lib.ReactNative.ScrollView, { contentContainerStyle: { padding: 24, gap: 12 } },
      React.createElement(R.Heading, { children: 'Records' }),
      React.createElement(R.Search, {
        label: 'Search', placeholder: 'Filter by title', value: query,
        onChangeText: function (value) {
          setQuery(value); setPage(0);
        },
        onClear: function () {
          setQuery(''); setPage(0);
        }
      }),
      React.createElement(R.HStack, null,
        STATUSES.map(function (status) {
          return React.createElement(R.SelectableTag, {
            key: status, text: status,
            selected: statuses.indexOf(status) !== -1,
            onChange: toggleStatus(status)
          });
        })),
      React.createElement(R.Layer, { level: 1 },
        Lib.Utils.isEmptyArray(visible)
          ? React.createElement(R.Tag, { children: 'No records', testID: 'records-empty' })
          : visible.map(function (record, index) {
            const absolute = current * PAGE_SIZE + index;
            return React.createElement(R.HStack, { key: record.title, testID: 'record-' + absolute },
              React.createElement(R.Link, {
                children: record.title,
                testID: 'record-title-' + absolute,
                onPress: function () {
                  setDetail(record);
                }
              }),
              React.createElement(R.Text, { children: record.owner }),
              React.createElement(R.Text, { children: record.updated }),
              React.createElement(R.Tag, { children: record.status }),
              React.createElement(R.ProgressBar, { label: record.title, value: record.percent }),
              React.createElement(View, {
                ref: function (node) {
                  anchors.current[absolute] = node;
                }
              },
              React.createElement(R.IconButton, {
                icon: 'overflow_vertical', label: 'more',
                onPress: openMenu(absolute)
              })));
          })),
      React.createElement(R.HStack, null,
        React.createElement(R.ButtonSet, {
          items: [
            { children: 'Previous', kind: 'secondary', disabled: current === 0, onPress: function () {
              setPage(current - 1);
            } },
            { children: 'Next', kind: 'secondary', disabled: current >= pageCount - 1, onPress: function () {
              setPage(current + 1);
            } }
          ]
        }),
        React.createElement(R.Section, { level: 6 },
          React.createElement(R.Heading, { testID: 'records-page', children: 'Page ' + (current + 1) + ' of ' + pageCount }))),
      menu !== null ? React.createElement(R.Menu, {
        items: MENU_ITEMS, open: true, x: menu.x, y: menu.y,
        accessibilityLabel: 'Record actions',
        onClose: function () {
          setMenu(null);
        }
      }) : null,
      React.createElement(R.Modal, {
        open: detail !== null,
        title: detail ? detail.title : '',
        onClose: function () {
          setDetail(null);
        },
        actions: [{ label: 'Close', onPress: function () {
          setDetail(null);
        } }],
        children: detail ? detail.owner + ' - updated ' + detail.updated + ' - ' + detail.status + ' - ' + detail.percent + '%' : ''
      })));

}
