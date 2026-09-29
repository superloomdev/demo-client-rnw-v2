// Info: Showcase index: the theme selection in effect and one link per
// component family in the library's catalog. The family page shows every
// sample state of every component in that family.
import { useLib } from '../../app-core/contexts/lib-context.js';
import { getFamilies, getHref } from './catalog.js';


export default function ShowcaseIndex () {

  // Init the container and the theme controller
  const Lib = useLib();
  const React = Lib.React;
  const { View, Text, ScrollView } = Lib.ReactNative;
  const Link = Lib.Navigation.Link;
  const ctx = Lib.ThemeContext.useThemeController();

  // Group the built components by family
  const families = getFamilies(Lib.Components.catalog);

  // Render the selection line and the family links
  return React.createElement(ScrollView, { testID: 'showcase-index', contentContainerStyle: { padding: 24, gap: 12 } },
    React.createElement(Text, { testID: 'showcase-selection', style: { fontSize: 20, fontWeight: '600' } },
      ctx.profileName + ' / ' + ctx.schemeName + (ctx.brandName ? ' + ' + ctx.brandName : '')),
    React.createElement(Text, { testID: 'showcase-count' }, 'Components: ' + Object.keys(ctx.Registry).length + ' in ' + families.length + ' families'),
    families.map(function (group) {
      return React.createElement(View, { key: group.family, testID: 'family-link-' + group.family },
        React.createElement(Link, { href: getHref('/showcase/' + group.family, ctx) },
          React.createElement(Text, null, group.family + ' (' + group.components.length + ')')));
    }));

}
