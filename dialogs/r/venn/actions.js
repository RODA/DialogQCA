const vennDialog = {
  target: plot_venn,
  truthTableSelect: select1,
  customCheckbox: custom,
  customLabel: label1,
  customInput: input1,
  resetButton: reset_button
};

onChange(select1, () => {
  callExternal('qca.syncVennDialog', vennDialog);
});

onClick(custom, () => {
  if (isChecked(custom)) show(input1);
  else hide(input1);
  callExternal('qca.syncVennDialog', vennDialog);
});

onChange(input1, () => {
  callExternal('qca.syncVennDialog', vennDialog);
});

onInput(input1, () => {
  callExternal('qca.syncVennDialog', vennDialog);
});

onClick(reset_button, async () => {
  resetDialog();
  await callExternal('qca.initializeVennDialog', vennDialog);
});

callExternal('qca.initializeVennDialog', vennDialog);
