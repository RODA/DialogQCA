let selected_source = '';
let result_name = '';
let assign_label_text = '';
let syncing_types = false;

const selectedTypes = () => ({
  all: isChecked(select_all),
  subsets: isChecked(subsets),
  csa: isChecked(csa),
  ssr: isChecked(ssr)
});

const selectedTypeCount = () => {
  const types = selectedTypes();
  return (types.all ? 1 : 0) + (types.subsets ? 1 : 0) + (types.csa ? 1 : 0) + (types.ssr ? 1 : 0);
};

const buildCommand = () => {
  if (!selected_source || selectedTypeCount() === 0) return '';

  const types = selectedTypes();
  const expression = String(getValue(expressions_input) || '').trim();
  const needs_expression = types.all || types.subsets;
  if (needs_expression && !expression) return '';

  const args = ['obj = ' + selected_source];
  if (needs_expression) {
    args.push('expression = ' + JSON.stringify(expression));
  }
  if (!isChecked(remainders)) {
    args.push('remainders = FALSE');
  }

  if (types.all) {
    args.push('type = 0');
  } else {
    const values = [];
    if (types.subsets) values.push('1');
    if (types.csa) values.push('2');
    if (types.ssr) values.push('3');
    if (values.length === 1) args.push('type = ' + values[0]);
    else if (values.length > 1) args.push('type = c(' + values.join(', ') + ')');
  }

  const prefix = isChecked(assign) && result_name ? result_name + ' <- ' : '';
  return prefix + 'findRows(' + args.join(', ') + ')\n';
};

const refresh = () => {
  if (syncing_types) return;

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

  if (isChecked(select_all)) {
    syncing_types = true;
    check(subsets);
    check(csa);
    check(ssr);
    syncing_types = false;
  } else {
    syncing_types = true;
    if (isChecked(subsets) && isChecked(csa) && isChecked(ssr)) check(select_all);
    else uncheck(select_all);
    syncing_types = false;
  }

  if (isChecked(subsets)) {
    enable(remainders);
    enable(expressions_input);
  } else {
    disable(remainders);
    disable(expressions_input);
  }

  updateSyntax(buildCommand());
};

enableSearch(c_datasets);
setValue(c_datasets, listObjects('truthtables'));
hide(object_name);
assign_label_text = String(getValue(assign_label) || 'Assign');
selected_source = getSelected(c_datasets)[0] || '';
refresh();

onChange(c_datasets, () => {
  clearError(c_datasets);
  selected_source = getSelected(c_datasets)[0] || '';
  refresh();
});

onChange(select_all, refresh);
onChange(subsets, () => {
  clearError(expressions_input);
  refresh();
});
onChange(csa, refresh);
onChange(ssr, refresh);
onChange(remainders, refresh);
onChange(assign, refresh);
onChange(expressions_input, () => {
  clearError(expressions_input);
  refresh();
});
onChange(object_name, () => {
  let next = String(getValue(object_name) || '').trim().replace(/[^A-Za-z0-9]/g, '');
  if (next && /^[0-9]/.test(next)) next = 'x' + next;
  if (next !== String(getValue(object_name) || '').trim()) setValue(object_name, next);
  result_name = next;
  clearError(object_name);
  refresh();
});

onClick(b_run, () => {
  const types = selectedTypes();
  const expression = String(getValue(expressions_input) || '').trim();

  if (!selected_source) {
    addError(c_datasets, 'No truth table selected');
    return;
  }

  if (selectedTypeCount() === 0) {
    addError(select_all, 'No type selected');
    return;
  }

  if ((types.all || types.subsets) && !expression) {
    addError(expressions_input, 'Expression needed');
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
  setValue(c_datasets, listObjects('truthtables'));
  hide(object_name);
  selected_source = getSelected(c_datasets)[0] || '';
  result_name = '';
  refresh();
});