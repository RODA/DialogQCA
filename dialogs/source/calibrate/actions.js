const calibrate_dialog = {
  dialogKey: 'qca.calibrate',
  stateKey: 'qca.calibrate.thresholds',
  datasetContainer: c_datasets,
  variableContainer: c_variables,
  typeCrisp: r_type_crisp,
  typeFuzzy: r_type_fuzzy,
  shapeBell: r_shape_bell,
  shapeS: r_shape_s,
  directionInc: r_dir_inc,
  directionDec: r_dir_dec,
  thresholdCount: cnt_nth,
  thresholdInputs: [i_th1, i_th2, i_th3, i_th4, i_th5, i_th6],
  thresholdLabels: [l_th1, l_th2, l_th3, l_th4, l_th5, l_th6],
  findThresholdsCheckbox: checkbox_findth,
  logisticCheckbox: checkbox_logistic,
  ecdfCheckbox: checkbox_ecdf,
  jitterCheckbox: checkbox_jitter,
  newConditionCheckbox: checkbox_new_condition,
  newConditionInput: i_newvar,
  idmInput: i_idm,
  aboveInput: i_above,
  belowInput: i_below,
  plot: plot_calibrate,
  shapeLabel: lbl_shape,
  shapeSLabel: lbl_shape_s,
  shapeBellLabel: lbl_shape_bell,
  directionLabel: lbl_direction,
  directionIncLabel: lbl_dir_inc,
  directionDecLabel: lbl_dir_dec,
  thresholdCountLabel: lbl_nth,
  findThresholdsLabel: lbl_findth,
  jitterLabel: lbl_jitter,
  logisticLabel: lbl_logistic,
  ecdfLabel: lbl_ecdf,
  idmLabel: lbl_idm,
  shapeFormLabel: lbl_shape_form,
  aboveLabel: lbl_above,
  belowLabel: lbl_below
};

const syncVariables = () => {
  const dataset = getSelected(c_datasets)[0] || '';
  if (!dataset) {
    clearContent(c_variables);
    return;
  }

  setValue(c_variables, listColumns(dataset));
};

enableSearch(c_datasets, c_variables);
setValue(c_datasets, listObjects('datasets'));
callExternal('qca.initializeCalibrateDialog', calibrate_dialog);

onChange(c_datasets, () => {
  syncVariables();
  callExternal('qca.syncCalibrateDialog', { ...calibrate_dialog, event: 'dataset' });
});

onChange(c_variables, () => {
  callExternal('qca.syncCalibrateDialog', { ...calibrate_dialog, event: 'variable' });
});

onChange(type_group, () => {
  callExternal('qca.syncCalibrateDialog', { ...calibrate_dialog, event: 'type' });
});

onChange(shape_group, () => {
  callExternal('qca.syncCalibrateDialog', { ...calibrate_dialog, event: 'shape' });
});

onChange(direction_group, () => {
  callExternal('qca.syncCalibrateDialog', { ...calibrate_dialog, event: 'direction' });
});

onChange(cnt_nth, () => {
  callExternal('qca.syncCalibrateDialog', { ...calibrate_dialog, event: 'thresholdCount' });
});

onInput(cnt_nth, () => {
  callExternal('qca.syncCalibrateDialog', { ...calibrate_dialog, event: 'thresholdCount' });
});

onClick(cnt_nth, () => {
  setTimeout(() => {
    callExternal('qca.syncCalibrateDialog', { ...calibrate_dialog, event: 'thresholdCount' });
  }, 0);
});

onChange(checkbox_logistic, () => {
  callExternal('qca.syncCalibrateDialog', { ...calibrate_dialog, event: 'logistic' });
});

onChange(checkbox_ecdf, () => {
  callExternal('qca.syncCalibrateDialog', { ...calibrate_dialog, event: 'ecdf' });
});

onChange(checkbox_findth, () => {
  callExternal('qca.syncCalibrateDialog', { ...calibrate_dialog, event: 'findThresholds' });
});

onClick(checkbox_findth, () => {
  setTimeout(() => {
    callExternal('qca.syncCalibrateDialog', { ...calibrate_dialog, event: 'findThresholds' });
  }, 0);
});

onChange(checkbox_jitter, () => {
  callExternal('qca.syncCalibrateDialog', { ...calibrate_dialog, event: 'refresh' });
});

onChange(checkbox_new_condition, () => {
  callExternal('qca.syncCalibrateDialog', { ...calibrate_dialog, event: 'refresh' });
});

onChange(i_newvar, () => {
  callExternal('qca.syncCalibrateDialog', { ...calibrate_dialog, event: 'refresh' });
});

onChange(i_idm, () => {
  callExternal('qca.syncCalibrateDialog', { ...calibrate_dialog, event: 'idm' });
});

onChange(i_above, () => {
  callExternal('qca.syncCalibrateDialog', { ...calibrate_dialog, event: 'above' });
});

onChange(i_below, () => {
  callExternal('qca.syncCalibrateDialog', { ...calibrate_dialog, event: 'below' });
});

onChange(i_th1, () => {
  callExternal('qca.syncCalibrateDialog', { ...calibrate_dialog, event: 'thresholdInput' });
});
onChange(i_th2, () => {
  callExternal('qca.syncCalibrateDialog', { ...calibrate_dialog, event: 'thresholdInput' });
});
onChange(i_th3, () => {
  callExternal('qca.syncCalibrateDialog', { ...calibrate_dialog, event: 'thresholdInput' });
});
onChange(i_th4, () => {
  callExternal('qca.syncCalibrateDialog', { ...calibrate_dialog, event: 'thresholdInput' });
});
onChange(i_th5, () => {
  callExternal('qca.syncCalibrateDialog', { ...calibrate_dialog, event: 'thresholdInput' });
});
onChange(i_th6, () => {
  callExternal('qca.syncCalibrateDialog', { ...calibrate_dialog, event: 'thresholdInput' });
});

onClick(b_run, async () => {
  const command = await callExternal('qca.validateCalibrateDialog', calibrate_dialog);
  if (command) run(command);
});

onClick(b_reset, () => {
  resetDialog();
  setValue(c_datasets, listObjects('datasets'));
  clearContent(c_variables);
  callExternal('qca.initializeCalibrateDialog', calibrate_dialog);
});
