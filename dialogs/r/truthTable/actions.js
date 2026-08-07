let selected_dataset = '<dataset>';
let selected_outcome = '<outcome>';
let selected_conditions = [];
let result_name = '';
let assign_label_text = '';

const sort_map = { outcome: 'out', inclusion: 'incl', frequency: 'n' };

// Optional arguments share lines up to this width, so a command with many
// settings stays compact instead of running down the screen.
const PACKED_WIDTH = 75;

const packArguments = (args) => {
  const lines = [];

  args.forEach((arg) => {
    const last = lines.length ? lines[lines.length - 1] : '';
    const joined = last ? last + ', ' + arg : arg;

    if (last && joined.length <= PACKED_WIDTH) {
      lines[lines.length - 1] = joined;
    } else {
      lines.push(arg);
    }
  });

  return lines;
};

const sortByArgument = () => {
  const selected = getSelected(sort_by);
  if (!selected.length) return '';

  const parts = selected.map((item) => {
    const value = String(item || '').trim();
    const descending = /:desc$/i.test(value);
    const label = value.replace(/:(asc|desc)$/i, '');
    return (sort_map[label] || label) + (descending ? '' : '+');
  });

  return 'sort.by = "' + parts.join(', ') + '"';
};

const buildCommand = () => {
  // Named first, because these say what is being explained by what.
  const mandatory = [];

  if (selected_outcome !== '<outcome>' && selected_outcome) {
    mandatory.push('outcome = "' + (isChecked(neg_out) ? '~' : '') + selected_outcome + '"');
  }

  if (selected_conditions.length) {
    mandatory.push('conditions = "' + selected_conditions.join(', ') + '"');
  }

  // Only the settings that differ from the R defaults are written out.
  const optional = [];

  const incl_1_value = String(getValue(incl_1) || '').trim() || '1';
  const incl_0_value = String(getValue(incl_0) || '').trim();
  if (incl_1_value !== '1' || (incl_0_value && incl_0_value !== '1')) {
    optional.push(incl_0_value
      ? 'incl.cut = "' + incl_1_value + ', ' + incl_0_value + '"'
      : 'incl.cut = ' + incl_1_value);
  }

  const n_cut_value = String(getValue(n_cut) || '').trim() || '1';
  if (n_cut_value !== '1') optional.push('n.cut = ' + n_cut_value);

  const pri_cut_value = String(getValue(pri_cut) || '').trim();
  if (pri_cut_value) optional.push('pri.cut = ' + pri_cut_value);

  const exclude_value = String(getValue(exclude) || '').trim();
  if (exclude_value) optional.push('exclude = ' + exclude_value);

  if (isChecked(complete)) optional.push('complete = TRUE');
  if (isChecked(use_letters)) optional.push('use.letters = TRUE');
  if (isChecked(show_cases)) optional.push('show.cases = TRUE');
  if (isChecked(show_cases) && isChecked(deviant_cases)) optional.push('dcc = TRUE');

  optional.push(sortByArgument());

  const command = call('truthTable', [
    selected_dataset,
    mandatory,
    packArguments(optional.filter(Boolean))
  ]);

  return (isChecked(assign) && result_name ? result_name + ' <- ' : '') + command;
};

const refresh = () => {
  if (isChecked(show_cases)) enable(deviant_cases);
  else {
    uncheck(deviant_cases);
    disable(deviant_cases);
  }

  if (isChecked(assign)) {
    show(object_name);
    setValue(assign_label, assign_label_text + ':');
    result_name = String(getValue(object_name) || '').trim();
  } else {
    hide(object_name);
    if (!assign_label_text) assign_label_text = String(getValue(assign_label) || 'Assign');
    setValue(assign_label, assign_label_text);
    result_name = '';
  }

  updateSyntax(buildCommand());
};

enableSearch(c_datasets, c_outcome, c_conditions);
callExternal('rememberVariableSelections', {
  source: c_datasets,
  dependents: [c_outcome, c_conditions]
});
const objectBinding = bindObjects({
  dialog: 'qca.truthTable',
  datasets: c_datasets,
  variables: [c_outcome, c_conditions]
});
setValue(incl_1, '1');
setValue(incl_0, '');
setValue(pri_cut, '');
setValue(n_cut, '1');
hide(object_name);
assign_label_text = String(getValue(assign_label) || 'Assign');
refresh();

onChange(c_datasets, () => {
  clearError(c_datasets);
  selected_dataset = getSelected(c_datasets)[0] || '<dataset>';
  selected_outcome = '<outcome>';
  selected_conditions = [];
  clearContent(object_name);

  if (selected_dataset === '<dataset>') {
    clearContent(c_outcome, c_conditions);
    refresh();
    return;
  }

  refresh();
});

onChange(c_outcome, () => {
  clearError(c_outcome);
  selected_outcome = getSelected(c_outcome)[0] || '<outcome>';
  refresh();
});

onChange(c_conditions, () => {
  clearError(c_conditions);
  selected_conditions = getSelected(c_conditions);
  refresh();
});

onChange(assign, refresh);
onChange(object_name, () => {
  clearError(object_name);
  result_name = String(getValue(object_name) || '').trim();
  updateSyntax(buildCommand());
});
onChange(neg_out, refresh);
onChange(complete, refresh);
onChange(use_letters, refresh);
onChange(show_cases, refresh);
onChange(deviant_cases, refresh);
onChange(sort_by, refresh);
onChange(exclude, refresh);
onChange(incl_1, refresh);
onChange(incl_0, refresh);
onChange(pri_cut, refresh);
onChange(n_cut, refresh);

onClick(b_run, () => {
  if (selected_dataset === '<dataset>') {
    addError(c_datasets, 'No dataset selected');
    return;
  }

  if (selected_outcome === '<outcome>') {
    addError(c_outcome, 'No outcome selected');
    return;
  }

  if (isChecked(assign) && !result_name) {
    addError(object_name, 'Object name needed');
    return;
  }

  run(buildCommand());
});

onClick(b_reset, () => {
  resetDialog();
  selected_dataset = '<dataset>';
  selected_outcome = '<outcome>';
  selected_conditions = [];
  result_name = '';
  objectBinding.refresh();
  setValue(incl_1, '1');
  setValue(incl_0, '');
  setValue(pri_cut, '');
  setValue(n_cut, '1');
  hide(object_name);
  clearContent(c_outcome, c_conditions);
  refresh();
});
