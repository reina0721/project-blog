export const mermaidTheme = {
  theme: 'base',
  look: 'classic',
  layout: 'dagre',
  htmlLabels: false,
  themeVariables: {
    background: '#ffffff',
    fontFamily: '"Segoe UI", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif',
    fontSize: '15px',
    primaryColor: '#f3f6fc',
    primaryBorderColor: '#9aaec9',
    primaryTextColor: '#213854',
    secondaryColor: '#e1ebff',
    tertiaryColor: '#f7f9fc',
    lineColor: '#627894',
    edgeLabelBackground: '#ffffff',
  },
  flowchart: {
    useMaxWidth: false,
    diagramPadding: 16,
    padding: 14,
    nodeSpacing: 22,
    rankSpacing: 36,
    wrappingWidth: 310,
    curve: 'linear',
  },
  themeCSS: `
    .node rect.label-container { rx: 7px; ry: 7px; }
    .node text > tspan:first-child > tspan { font-weight: 700; }
    .edge-thickness-normal { stroke-width: 1.25px; }
    .edge-thickness-thick { stroke-width: 2.5px; stroke: #375c9f; }
  `,
};
