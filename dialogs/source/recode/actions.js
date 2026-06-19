let recoded_condition = '';
let selected_dataset = '<dataset>';
let selected_condition = '<condition>';
let old_value = '';
let new_value = '';

callExternal('rememberVariableSelections', {
  source: c_datasets,
  dependents: [c_conditions]
});
enableSearch(c_datasets, c_conditions);
setValue(c_datasets, listObjects("datasets"));

onChange(c_datasets, () => {
  clearError(c_datasets);
  selected_dataset = getSelected(c_datasets);
  if (selected_dataset.length == 0) {
    selected_dataset = '<dataset>';
    clearContent(c_conditions);
    selected_condition = '<condition>';
  } else {
    setValue(c_conditions, listColumns(selected_dataset));
    selected_condition = getSelected(c_conditions);
    if (selected_condition.length == 0) {
      selected_condition = '<condition>';
    }
  }
  updateSyntax(buildCommand());
});

onChange(c_conditions, () => {
  clearError(c_conditions);
  selected_condition = getSelected(c_conditions);
  if (selected_condition.length == 0) {
    selected_condition = '<condition>';
  }
  triggerChange(checkbox1); // to update recoded_condition
  updateSyntax(buildCommand());
});

onClick(i_value_old, () => check(r_old1));
onClick(i_lowesto, () => check(r_old2));
onClick(i_from, () => check(r_old3));
onClick(i_to, () => check(r_old3));
onClick(i_tohighest, () => check(r_old4));
onClick(i_value_new, () => check(r_new1));

onChange(radiogroup1, () => {
  if (isChecked(r_old1)) triggerChange(i_value_old);
  if (isChecked(r_old2)) triggerChange(i_lowesto);
  if (isChecked(r_old3)) triggerChange(i_from); // also checks i_to
  if (isChecked(r_old4)) triggerChange(i_tohighest);
  if (isChecked(r_old5)) old_value = "missing";
  if (isChecked(r_old6)) old_value = "else";
});

onChange(radiogroup2, () => {
  if (isChecked(r_new1)) triggerChange(i_value_new);
  if (isChecked(r_new2)) new_value = 'missing';
  if (isChecked(r_new3)) new_value = 'copy';
});

onChange(i_value_old, () => old_value = getValue(i_value_old));

onChange(i_lowesto, () => {
  const lowesto = getValue(i_lowesto);
  old_value = lowesto ? 'lo:' + lowesto : '';
  //old_value = '';
  //if (lowesto) {
    //old_value = 'lo:' + lowesto;
  //}
});

// delegate to i_to
onChange(i_from, () => triggerChange(i_to));

onChange(i_to, () => {
  const from = getValue(i_from);
  const to = getValue(i_to);
  old_value = (from && to) ? from + ':' + to : '';
});

onChange(i_tohighest, () => {
  const tohighest = getValue(i_tohighest);
  old_value = tohighest ? tohighest + ':hi' : '';
});

onChange(i_value_new, () => new_value = getValue(i_value_new));

onClick(b_add, () => {
  if (old_value && new_value) {
    addValue(c_rules, old_value + '=' + new_value);
    clearContent(i_value_old, i_lowesto, i_from, i_to, i_tohighest, i_value_new);
    clearError(c_rules);
    updateSyntax(buildCommand());
  } else if (old_value) {
    addError(c_rules, 'new value not defined');
  } else if (new_value) {
    addError(c_rules, 'old value not defined');
  } else {
    addError(c_rules, 'old and new values needed');
  }
});

onClick(b_remove, () => {
  clearValue(c_rules, getSelected(c_rules));
  updateSyntax(buildCommand());
});

onClick(b_clear, () => {
  clearContent(c_rules);
  updateSyntax(buildCommand());
});

onChange(checkbox1, () => {
  if (isChecked(checkbox1)) {
    show(i_newvar);
    const newvar = getValue(i_newvar);
    recoded_condition = newvar ? newvar : selected_condition;
    updateSyntax(buildCommand());
  } else {
    hide(i_newvar);
    recoded_condition = selected_condition;
    updateSyntax(buildCommand());
  }
});

onChange(i_newvar, () => {
  clearError(i_newvar);
  const newvar = getValue(i_newvar);
  recoded_condition = newvar ? newvar : selected_condition;
  updateSyntax(buildCommand());
});

const buildCommand = () => {
  const rules = getValue(c_rules);
  triggerChange(checkbox1); // to update recoded_condition
  
  let command = 'inside(' + selected_dataset + ',\n  ';
  command += recoded_condition + ' <- recode(';
  command += selected_condition + ',\n    rules = "';
  command += rules ? rules.join('; ') : '';
  command += '"\n  )\n)\n';
  return command;
}

onClick(b_run, () => {
  if (selected_dataset === '<dataset>') {
    addError(c_datasets, "No dataset selected");
    return;
  }
  
  if (selected_condition === '<condition>') {
    addError(c_conditions, "No condition selected");
    return;
  }
  
  if (!getValue(c_rules)) {
    addError(c_rules, "No recoding rules");
    return;
  }

  if (isChecked(checkbox1)) {
    const newvar = getValue(i_newvar);
    if (!newvar) {
      addError(i_newvar, "New condition needs a name.")
    }
  } else {
    clearError(i_newvar);
  }

  run(buildCommand());
});

onClick(b_reset, () => {
  resetDialog();
})

updateSyntax(buildCommand());
