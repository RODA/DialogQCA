let core_selections = {};

const fiss_dialog = {
  solutionSelect: solution_select,
  branchSelect: branch_select,
  modelSelect: model_select,
  ambiguitySelect: ambiguity_select,
  ambiguityLabel: ambiguity_label,
  coreTermSelect: core_term_select,
  coreTermLabel: core_term_label,
  titleInput: title_input,
  legendCheckbox: legend_checkbox,
  labelsCheckbox: labels_checkbox,
  messageLabel: message_label,
  plot: plot_fiss,
  resetButton: reset_button
};

const syncFiss = async (event) => {
  const state = await callExternal('qca.syncFissDialog', {
    ...fiss_dialog,
    event: event,
    coreSelections: core_selections
  });

  if (state && state.coreSelections) {
    core_selections = { ...state.coreSelections };
  }

  return state;
};

onChange(solution_select, async () => {
  core_selections = {};
  await syncFiss('solution');
});

onChange(branch_select, async () => {
  core_selections = {};
  await syncFiss('branch');
});

onChange(model_select, async () => {
  core_selections = {};
  await syncFiss('model');
});

onChange(ambiguity_select, async () => {
  await syncFiss('ambiguity');
});

onChange(core_term_select, async () => {
  const configuration = getSelected(ambiguity_select)[0] || '';
  const term = getSelected(core_term_select)[0] || '';

  if (configuration && term) {
    core_selections[configuration] = term;
  }

  await syncFiss('core');
});

onInput(title_input, () => syncFiss('title'));
onChange(title_input, () => syncFiss('title'));
onChange(legend_checkbox, () => syncFiss('legend'));
onChange(labels_checkbox, () => syncFiss('labels'));

onClick(reset_button, async () => {
  core_selections = {};
  resetDialog();
  await callExternal('qca.initializeFissDialog', {
    ...fiss_dialog,
    coreSelections: core_selections
  });
});

callExternal('qca.initializeFissDialog', {
  ...fiss_dialog,
  coreSelections: core_selections
}).then((state) => {
  if (state && state.coreSelections) {
    core_selections = { ...state.coreSelections };
  }
});
