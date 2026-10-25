// Info: Showcase index: the theme selection in effect, the build progress
// over the whole roster, one link per family with its built/total count
// and milestone tag, and the sample screens. Composed from the library's
// own components; host Text appears only where the library has no row.
import { useLib } from '../../app-core/contexts/lib-context.js';
import Scene from '../Scene.js';
import { getRoster, getTotals, getHref } from './catalog.js';
import { MILESTONES } from './planned-rows.js';

// The three sample screens of the Samples section
const SAMPLES = [
  { name: 'sign-in', title: 'Sign in' },
  { name: 'settings', title: 'Settings' },
  { name: 'records', title: 'Records' }
];


export default function ShowcaseIndex () {

  // Init the container and the theme controller
  const Lib = useLib();
  const React = Lib.React;
  const { ScrollView } = Lib.ReactNative;
  const Link = Lib.Navigation.Link;
  const ctx = Lib.ThemeContext.useThemeController();
  const R = ctx.Registry;

  // Merge the built catalog with the whole roster
  const groups = getRoster(Lib.Components.catalog);
  const totals = getTotals(groups);

  // Render the progress line, the family links and the sample section
  return React.createElement(Scene, null,
    React.createElement(ScrollView, { testID: 'showcase-index', contentContainerStyle: { padding: 24, gap: 16 } },
      React.createElement(R.Stack, null,
        React.createElement(R.Heading, { children: 'Components' }),
        React.createElement(R.Text, { testID: 'showcase-selection', children: ctx.profileName + ' / ' + ctx.schemeName + (ctx.brandName ? ' + ' + ctx.brandName : '') }),
        React.createElement(R.Text, { testID: 'showcase-progress', children: totals.built + ' of ' + totals.total + ' components built' }),
        React.createElement(R.ProgressBar, { label: 'Build progress', value: Math.round(totals.built / totals.total * 100) }),
        groups.map(function (group) {
          const milestone = MILESTONES[group.family];
          return React.createElement(R.HStack, { key: group.family, testID: 'family-link-' + group.family },
            React.createElement(Link, { href: getHref('/showcase/' + group.family, ctx) },
              React.createElement(R.Text, { children: group.family + ' ' + group.built + '/' + group.total })),
            group.built < group.total && milestone
              ? React.createElement(R.Tag, { children: milestone, size: 'sm' })
              : null);
        }),
        React.createElement(R.Divider),
        React.createElement(R.Section, { level: 2 },
          React.createElement(R.Heading, { children: 'Sample screens' }),
          SAMPLES.map(function (sample) {
            return React.createElement(Link, { key: sample.name, href: getHref('/samples/' + sample.name, ctx) },
              React.createElement(R.Text, { testID: 'sample-link-' + sample.name, children: sample.title }));
          })))));

}
