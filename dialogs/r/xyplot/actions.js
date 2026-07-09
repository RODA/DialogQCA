const xyplot_dialog = {
  dialogKey: 'qca.xyplot',
  datasetContainer: c_datasets,
  xContainer: c_x,
  yContainer: c_y,
  plot: plot_xy,
  sufficiencyRadio: r_suf,
  necessityRadio: r_nec,
  negateXCheckbox: neg_x,
  negateYCheckbox: neg_y,
  pofCheckbox: pof,
  guidesCheckbox: guides,
  fillCheckbox: fill,
  jitterCheckbox: jitter,
  casesCheckbox: cases,
  rotateInput: rotate,
  rotateLabel: label7,
  xAxisLabel: xaxis_label,
  yAxisLabel: yaxis_label,
  measureLabels: [label15, label17, label19],
  measureValues: [incl_value, cov_value, pri_value],
  separators: [separator1, separator2, separator3, separator4]
};

callExternal('rememberVariableSelections', {
  source: c_datasets,
  dependents: [c_x, c_y]
});
enableSearch(c_datasets, c_x, c_y);
bindObjects({
  dialog: 'qca.xyplot',
  datasets: c_datasets,
  variables: [c_x, c_y]
});
callExternal('qca.initializeXYPlotDialog', xyplot_dialog);

onChange(c_datasets, () => {
  callExternal('qca.syncXYPlotDialog', { ...xyplot_dialog, event: 'dataset' });
});

onChange(c_x, () => {
  callExternal('qca.syncXYPlotDialog', { ...xyplot_dialog, event: 'x' });
});

onChange(c_y, () => {
  callExternal('qca.syncXYPlotDialog', { ...xyplot_dialog, event: 'y' });
});

onChange(radiogroup1, () => {
  callExternal('qca.syncXYPlotDialog', { ...xyplot_dialog, event: 'refresh' });
});
onChange(neg_x, () => {
  callExternal('qca.syncXYPlotDialog', { ...xyplot_dialog, event: 'refresh' });
});
onChange(neg_y, () => {
  callExternal('qca.syncXYPlotDialog', { ...xyplot_dialog, event: 'refresh' });
});
onChange(pof, () => {
  callExternal('qca.syncXYPlotDialog', { ...xyplot_dialog, event: 'refresh' });
});
onChange(guides, () => {
  callExternal('qca.syncXYPlotDialog', { ...xyplot_dialog, event: 'refresh' });
});
onChange(fill, () => {
  callExternal('qca.syncXYPlotDialog', { ...xyplot_dialog, event: 'refresh' });
});
onChange(jitter, () => {
  callExternal('qca.syncXYPlotDialog', { ...xyplot_dialog, event: 'refresh' });
});
onChange(cases, () => {
  callExternal('qca.syncXYPlotDialog', { ...xyplot_dialog, event: 'refresh' });
});
onChange(rotate, () => {
  callExternal('qca.syncXYPlotDialog', { ...xyplot_dialog, event: 'refresh' });
});
