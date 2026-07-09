const vennDialog = {
  target: plot_venn,
  truthTableSelect: select1,
  customCheckbox: custom,
  customInput: input1
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

callExternal('qca.initializeVennDialog', vennDialog);