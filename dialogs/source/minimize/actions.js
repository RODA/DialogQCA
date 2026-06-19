let source_mode = 'tt';
let selected_source = '';
let selected_outcome = '';
let selected_conditions = [];
let result_name = '';
let assign_label_text = '';
let truth_tables = [];
let data_options = {
  incl1: '1',
  incl0: '',
  priCut: '',
  nCut: '1',
  negOut: false,
  showCases: false,
  useLetters: false
};

const contradictionChoiceLabel = (() => {
  const assignText = String(getValue(assign_label) || 'Assign').trim().replace(/:$/, '');
  if (assignText === 'Zuweisen') return 'W';
  if (assignText === 'Przypisz') return 'S';
  if (assignText === 'Ανάθεση') return 'Α';
  return 'C';
})();

const toVisibleIncludeValues = (values) => ['?', contradictionChoiceLabel].filter((item) => {
  if (!Array.isArray(values)) return false;
  if (item === '?') return values.includes('?');
  return values.includes('C') || values.includes(contradictionChoiceLabel);
});

const getIncludeValues = () => {
  const selected = getSelected(choice1);
  return ['?', 'C'].filter((item) => {
    if (!Array.isArray(selected)) return false;
    if (item === '?') return selected.includes('?');
    return selected.includes('C') || selected.includes(contradictionChoiceLabel);
  });
};

const setIncludeValues = (values) => {
  setSelected(choice1, toVisibleIncludeValues(['?', 'C'].filter((item) => Array.isArray(values) && values.includes(item))));
};

const applyLocalizedIncludeChoices = () => {
  const selected = getIncludeValues();
  setValue(choice1, ['?', contradictionChoiceLabel]);
  setSelected(choice1, toVisibleIncludeValues(selected));
};

const normalizeConditionList = (value) => {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  const text = String(value || '').trim();
  return text ? text.split(',').map((item) => item.trim()).filter(Boolean) : [];
};

const syncTruthTableSelections = () => {
  if (source_mode !== 'tt') return;
  const entry = Array.isArray(truth_tables) ? truth_tables.find((item) => String(item?.name || '').trim() === selected_source) : null;
  const outcome = String(entry?.options?.outcome || '').trim();
  const conditions = normalizeConditionList(entry?.options?.conditions);
  selected_outcome = outcome;
  selected_conditions = conditions;
  setValue(c_outcome, outcome ? [outcome] : []);
  setSelected(c_outcome, outcome ? [outcome] : []);
  setValue(c_conditions, conditions);
  setSelected(c_conditions, conditions);
};

const buildCommand = () => {
  const source_name = selected_source || (source_mode === 'tt' ? '<tt>' : '<dataset>');
  const prefix = isChecked(assign) && result_name ? result_name + ' <- ' : '';
  const header = prefix + 'minimize(' + source_name;
  const mandatory_args = [];
  const optional_args = [];

  if (source_mode === 'data') {
    if (selected_outcome) {
      mandatory_args.push('outcome = \"' + (isChecked(neg_out) ? '~' : '') + selected_outcome + '\"');
    }
    if (selected_conditions.length) {
      mandatory_args.push('conditions = \"' + selected_conditions.join(', ') + '\"');
    }
    if (isChecked(checkbox1)) optional_args.push('use.letters = TRUE');

    const incl_1_value = String(getValue(incl_1) || '').trim() || '1';
    const incl_0_value = String(getValue(incl_0) || '').trim();
    if (incl_1_value !== '1') {
      if (!incl_0_value) optional_args.push('incl.cut = ' + incl_1_value);
      else optional_args.push('incl.cut = \"' + incl_1_value + ', ' + incl_0_value + '\"');
    }

    const pri_cut_value = String(getValue(pri_cut) || '').trim();
    if (pri_cut_value && pri_cut_value !== '0') optional_args.push('pri.cut = ' + pri_cut_value);

    const n_cut_value = String(getValue(n_cut) || '').trim() || '1';
    if (n_cut_value !== '1') optional_args.push('n.cut = ' + n_cut_value);
  }

  const include_values = getIncludeValues();
  if (include_values.length) optional_args.push('include = \"' + include_values.join(', ') + '\"');

  const directional_expectations = String(getValue(input4) || '').trim();
  if (directional_expectations && include_values.includes('?')) {
    optional_args.push('dir.exp = \"' + directional_expectations + '\"');
  }

  if (isChecked(show_details)) optional_args.push('details = TRUE');
  if (isChecked(max_sol)) optional_args.push('all.sol = TRUE');
  if (isChecked(row_dom)) optional_args.push('row.dom = TRUE');

  const pi_cons = String(getValue(input3) || '').trim() || '0';
  if (pi_cons !== '0') optional_args.push('pi.cons = ' + pi_cons);

  const pi_depth_value = Math.max(0, (Number(getValue(pi_depth)) || 1) - 1);
  if (pi_depth_value > 0) optional_args.push('pi.depth = ' + pi_depth_value);

  const sol_cons = String(getValue(input2) || '').trim() || '0';
  if (sol_cons !== '0') optional_args.push('sol.cons = ' + sol_cons);

  const sol_cov = String(getValue(input1) || '').trim() || '1';
  if (sol_cov !== '1') optional_args.push('sol.cov = ' + sol_cov);

  const sol_depth_value = Math.max(0, (Number(getValue(sol_depth)) || 1) - 1);
  if (sol_depth_value > 0) optional_args.push('sol.depth = ' + sol_depth_value);

  const all_args = mandatory_args.concat(optional_args);
  if (!all_args.length) return header + ')\n';

  const lines = [header + ','];
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

  if (source_mode === 'data') {
    enable(c_outcome);
    enable(c_conditions);
    enable(incl_1);
    enable(incl_0);
    enable(pri_cut);
    enable(n_cut);
    enable(neg_out);
    enable(checkbox1);
    enable(show_cases);
  } else {
    disable(c_outcome);
    disable(c_conditions);
    disable(incl_1);
    disable(incl_0);
    disable(pri_cut);
    disable(n_cut);
    disable(neg_out);
    disable(checkbox1);
    uncheck(show_cases);
    disable(show_cases);
  }

  if (getIncludeValues().includes('?')) {
    show(label31);
    show(input4);
  } else {
    hide(label31);
    hide(input4);
  }

  updateSyntax(buildCommand());
};

enableSearch(c_datasets, c_outcome, c_conditions);
callExternal('rememberVariableSelections', {
  source: c_datasets,
  dependents: [c_outcome, c_conditions]
});
hide(object_name);
assign_label_text = String(getValue(assign_label) || 'Assign');
applyLocalizedIncludeChoices();

const loadCurrentSource = async () => {
  if (source_mode === 'tt') {
    truth_tables = await callExternal('qca.listTruthTables') || [];
    const truth_table_names = Array.isArray(truth_tables) ? truth_tables.map((item) => String(item?.name || '').trim()).filter(Boolean) : [];
    setValue(c_datasets, truth_table_names);
    if (truth_table_names.length === 1) setSelected(c_datasets, [truth_table_names[0]]);
    selected_source = getSelected(c_datasets)[0] || '';
    syncTruthTableSelections();
    return;
  }

  setValue(c_datasets, listObjects('datasets'));
  if (listObjects('datasets').length === 1) {
    const only_dataset = listObjects('datasets')[0];
    setSelected(c_datasets, [only_dataset]);
  }
  selected_source = getSelected(c_datasets)[0] || '';
  if (selected_source) {
    const variables = listColumns(selected_source);
    setValue(c_outcome, variables);
    setValue(c_conditions, variables);
  } else {
    clearContent(c_outcome, c_conditions);
  }
};

const storeDataOptions = () => {
  if (source_mode !== 'data') return;
  data_options = {
    incl1: String(getValue(incl_1) || '').trim() || '1',
    incl0: String(getValue(incl_0) || '').trim(),
    priCut: String(getValue(pri_cut) || '').trim(),
    nCut: String(getValue(n_cut) || '').trim() || '1',
    negOut: isChecked(neg_out),
    showCases: isChecked(show_cases),
    useLetters: isChecked(checkbox1)
  };
};

const applyDataOptions = () => {
  setValue(incl_1, data_options.incl1 || '1');
  setValue(incl_0, data_options.incl0 || '');
  setValue(pri_cut, data_options.priCut || '0');
  setValue(n_cut, data_options.nCut || '1');
  setValue(neg_out, !!data_options.negOut);
  setValue(show_cases, !!data_options.showCases);
  setValue(checkbox1, !!data_options.useLetters);
};

source_mode = isChecked(r_truthtable) ? 'tt' : 'data';
loadCurrentSource().then(refresh);

onChange(radiogroup1, async () => {
  const next_mode = isChecked(r_truthtable) ? 'tt' : 'data';
  if (next_mode === source_mode) {
    refresh();
    return;
  }

  if (source_mode === 'data') storeDataOptions();
  source_mode = next_mode;
  selected_source = '';
  selected_outcome = '';
  selected_conditions = [];
  clearContent(c_datasets, c_outcome, c_conditions);

  if (source_mode === 'data') applyDataOptions();
  await loadCurrentSource();
  refresh();
});

onChange(c_datasets, async () => {
  clearError(c_datasets);
  selected_source = getSelected(c_datasets)[0] || '';
  selected_outcome = '';
  selected_conditions = [];

  if (source_mode === 'data') {
    if (selected_source) {
      const variables = listColumns(selected_source);
      setValue(c_outcome, variables);
      setValue(c_conditions, variables);
    } else {
      clearContent(c_outcome, c_conditions);
    }
  } else {
    syncTruthTableSelections();
  }

  refresh();
});

onChange(c_outcome, () => {
  clearError(c_outcome);
  selected_outcome = getSelected(c_outcome)[0] || '';
  refresh();
});

onChange(c_conditions, () => {
  clearError(c_conditions);
  selected_conditions = getSelected(c_conditions);
  refresh();
});

onChange(assign, refresh);
onChange(object_name, refresh);
onChange(show_details, refresh);
onChange(max_sol, refresh);
onChange(row_dom, refresh);
onChange(neg_out, () => { storeDataOptions(); refresh(); });
onChange(show_cases, () => { storeDataOptions(); refresh(); });
onChange(checkbox1, () => { storeDataOptions(); refresh(); });
onChange(incl_1, () => { storeDataOptions(); refresh(); });
onChange(incl_0, () => { storeDataOptions(); refresh(); });
onChange(pri_cut, () => { storeDataOptions(); refresh(); });
onChange(n_cut, () => { storeDataOptions(); refresh(); });
onChange(choice1, refresh);
onChange(input4, refresh);
onChange(input1, refresh);
onChange(input2, () => {
  const value = String(getValue(input2) || '').trim();
  if (value && value !== '1') {
    const include_values = getIncludeValues();
    if (!include_values.includes('?')) setIncludeValues(include_values.concat('?'));
  }
  refresh();
});
onChange(input3, () => {
  const value = String(getValue(input3) || '').trim();
  if (value && value !== '1') {
    const include_values = getIncludeValues();
    if (!include_values.includes('?')) setIncludeValues(include_values.concat('?'));
  }
  refresh();
});
onChange(sol_depth, refresh);
onChange(pi_depth, refresh);

onClick(b_run, () => {
  if (!selected_source) {
    addError(c_datasets, source_mode === 'tt' ? 'No truth table selected' : 'No dataset selected');
    return;
  }

  if (source_mode === 'data' && !selected_outcome) {
    addError(c_outcome, 'No outcome selected');
    return;
  }

  if (source_mode === 'data' && !selected_conditions.length) {
    addError(c_conditions, 'No condition(s) selected');
    return;
  }

  if (isChecked(assign) && !String(getValue(object_name) || '').trim()) {
    addError(object_name, 'Object name needed');
    return;
  }

  run(buildCommand());
});

onClick(b_reset, async () => {
  resetDialog();
  applyLocalizedIncludeChoices();
  source_mode = isChecked(r_truthtable) ? 'tt' : 'data';
  selected_source = '';
  selected_outcome = '';
  selected_conditions = [];
  result_name = '';
  if (source_mode === 'data') applyDataOptions();
  await loadCurrentSource();
  refresh();
});