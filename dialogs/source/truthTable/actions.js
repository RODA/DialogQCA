let selected_dataset = '<dataset>';
let selected_outcome = '<outcome>';
let selected_conditions = [];
let result_name = '';
let assign_label_text = '';

const sort_map = { outcome: 'out', inclusion: 'incl', frequency: 'n' };

const buildCommand = () => {
  const header = (isChecked(assign) && result_name ? result_name + ' <- ' : '') + 'truthTable(' + selected_dataset;
  const lines = [];
  const mandatory_args = [];
  const optional_args = [];

  if (selected_outcome !== '<outcome>' && selected_outcome) {
    mandatory_args.push('outcome = \"' + (isChecked(neg_out) ? '~' : '') + selected_outcome + '\"');
  }

  if (selected_conditions.length) {
    mandatory_args.push('conditions = \"' + selected_conditions.join(', ') + '\"');
  }

  const incl_1_value = String(getValue(incl_1) || '').trim() || '1';
  const incl_0_value = String(getValue(incl_0) || '').trim();
  if (incl_1_value !== '1' || (incl_0_value && incl_0_value !== '1')) {
    if (!incl_0_value) optional_args.push('incl.cut = ' + incl_1_value);
    else optional_args.push('incl.cut = \"' + incl_1_value + ', ' + incl_0_value + '\"');
  }

  const n_cut_value = String(getValue(n_cut) || '').trim() || '1';
  if (n_cut_value !== '1') optional_args.push('n.cut = ' + n_cut_value);

  const pri_cut_value = String(getValue(pri_cut) || '').trim();
  if (pri_cut_value) optional_args.push('pri.cut = ' + pri_cut_value);

  const exclude_value = String(getValue(exclude) || '').trim();
  if (exclude_value) optional_args.push('exclude = ' + exclude_value);

  if (isChecked(complete)) optional_args.push('complete = TRUE');
  if (isChecked(use_letters)) optional_args.push('use.letters = TRUE');
  if (isChecked(show_cases)) optional_args.push('show.cases = TRUE');
  if (isChecked(show_cases) && isChecked(deviant_cases)) optional_args.push('dcc = TRUE');

  const sort_selected = getSelected(sort_by);
  if (Array.isArray(sort_selected) && sort_selected.length) {
    const sort_parts = sort_selected.map((item) => {
      const value = String(item || '').trim();
      const descending = /:desc$/i.test(value);
      const label = value.replace(/:(asc|desc)$/i, '');
      return (sort_map[label] || label) + (descending ? '' : '+');
    });
    optional_args.push('sort.by = \"' + sort_parts.join(', ') + '\"');
  }

  const all_args = mandatory_args.concat(optional_args);
  if (!all_args.length) {
    return header + ')\n';
  }

  lines.push(header + ',');
  mandatory_args.forEach((arg) => {
    lines.push('  ' + arg + ',');
  });

  const packed = [];
  optional_args.forEach((arg) => {
    if (!packed.length) {
      packed.push(arg);
      return;
    }
    const candidate = packed[packed.length - 1] + ', ' + arg;
    if (candidate.length > 75) packed.push(arg);
    else packed[packed.length - 1] = candidate;
  });

  packed.forEach((line, index) => {
    lines.push('  ' + line + (index === packed.length - 1 ? '' : ','));
  });

  if (!optional_args.length && lines.length > 1) {
    lines[lines.length - 1] = lines[lines.length - 1].replace(/,$/, '');
  }

  lines.push(')');
  return lines.join('\n') + '\n';
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
setValue(c_datasets, listObjects('datasets'));
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

  const variables = listColumns(selected_dataset);
  setValue(c_outcome, variables);
  setValue(c_conditions, variables);
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
  setValue(c_datasets, listObjects('datasets'));
  setValue(incl_1, '1');
  setValue(incl_0, '');
  setValue(pri_cut, '');
  setValue(n_cut, '1');
  hide(object_name);
  clearContent(c_outcome, c_conditions);
  refresh();
});