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

// Every one of these settings only changes how the plot is drawn.
const refreshPlot = () => callExternal('qca.syncXYPlotDialog', {
  ...xyplot_dialog,
  event: 'refresh'
});

onChange(radiogroup1, refreshPlot);
onChange(neg_x, refreshPlot);
onChange(neg_y, refreshPlot);
onChange(pof, refreshPlot);
onChange(guides, refreshPlot);
onChange(fill, refreshPlot);
onChange(jitter, refreshPlot);
onChange(cases, refreshPlot);
onChange(rotate, refreshPlot);
