import {
    setDialogControlChecked,
    setDialogControlEnabled,
    setDialogControlPlotPayload,
    setDialogControlSelected,
    setDialogControlValue,
    setDialogControlVisible,
    type DialogControlModel
} from "../dialog-runtime/dialogControlModel";
import type { QcaCalibrateDialogViewState } from "./qcaCalibrateDialog";
import type { QcaVennDialogState } from "./qcaVennDialog";
import type { QcaXYPlotDialogState } from "./qcaXYPlotDialog";


export interface QcaVennDialogControls {
    truthTableSelect: string;
    customInput: string;
    plot: string;
}


export interface QcaXYPlotDialogControls {
    rotateInput: string;
    rotateLabel: string;
    xAxisLabel: string;
    yAxisLabel: string;
    measureLabels: string[];
    measureValues: string[];
    separators: string[];
    plot: string;
}


const setControlNamesVisible = function(
    model: DialogControlModel,
    controlNames: string[],
    visible: boolean
): void {
    controlNames.filter(Boolean).forEach((name) => {
        setDialogControlVisible(model, name, visible);
    });
};


const setNamedControlChecked = function(model: DialogControlModel, controlName: string, checked: boolean): void {
    if (controlName) {
        setDialogControlChecked(model, controlName, checked);
    }
};


const setNamedControlEnabled = function(model: DialogControlModel, controlName: string, enabled: boolean): void {
    if (controlName) {
        setDialogControlEnabled(model, controlName, enabled);
    }
};


const setNamedControlValue = function(model: DialogControlModel, controlName: string, value: unknown): void {
    if (controlName) {
        setDialogControlValue(model, controlName, value);
    }
};


const setNamedControlVisible = function(model: DialogControlModel, controlName: string, visible: boolean): void {
    if (controlName) {
        setDialogControlVisible(model, controlName, visible);
    }
};


const splitMeasureLabel = function(label: string): { name: string; value: string } {
    const index = label.indexOf(":");

    if (index < 0) {
        return {
            name: label,
            value: ""
        };
    }

    return {
        name: label.slice(0, index + 1).trim(),
        value: label.slice(index + 1).trim()
    };
};


export const applyQcaVennDialogState = function(
    model: DialogControlModel,
    controls: QcaVennDialogControls,
    state: QcaVennDialogState
): void {
    setDialogControlValue(model, controls.truthTableSelect, state.truthTableNames);
    setDialogControlSelected(model, controls.truthTableSelect, state.selectedTruthTable);
    setDialogControlVisible(model, controls.customInput, state.renderPayload.showCustom);
    setDialogControlPlotPayload(model, controls.plot, state.renderPayload);
};


export const applyQcaCalibrateDialogState = function(
    model: DialogControlModel,
    viewState: QcaCalibrateDialogViewState
): void {
    const controls = viewState.controls;
    const state = viewState.state;
    const crisp = state.crisp === true;
    const logistic = state.logistic === true;
    const ecdf = state.ecdf === true;
    const bell = state.bell === true;
    const useNewCondition = state.useNewCondition === true;
    const showShapeForm = !crisp && !logistic && !ecdf;
    const showThresholdCount = crisp;
    const showFindThresholds = !crisp;
    const showJitter = viewState.previewPayload !== null && viewState.previewPayload !== undefined;

    setNamedControlChecked(model, controls.typeCrisp, crisp);
    setNamedControlChecked(model, controls.typeFuzzy, !crisp);
    setNamedControlChecked(model, controls.shapeBell, bell);
    setNamedControlChecked(model, controls.shapeS, !bell);
    setNamedControlChecked(model, controls.directionInc, state.increasing !== false);
    setNamedControlChecked(model, controls.directionDec, state.increasing === false);
    setNamedControlChecked(model, controls.findThresholdsCheckbox, state.findThresholds === true);
    setNamedControlChecked(model, controls.jitterCheckbox, state.jitter === true);
    setNamedControlChecked(model, controls.newConditionCheckbox, useNewCondition);
    setNamedControlValue(model, controls.thresholdCount, viewState.visibleThresholdCount);
    setNamedControlVisible(model, controls.thresholdCount, showThresholdCount);
    setNamedControlEnabled(model, controls.thresholdCount, showThresholdCount);
    setNamedControlVisible(model, controls.thresholdCountLabel, showThresholdCount);
    setNamedControlVisible(model, controls.findThresholdsCheckbox, showFindThresholds);
    setNamedControlEnabled(model, controls.findThresholdsCheckbox, showFindThresholds);
    setNamedControlVisible(model, controls.findThresholdsLabel, showFindThresholds);
    setNamedControlVisible(model, controls.jitterCheckbox, showJitter);
    setNamedControlEnabled(model, controls.jitterCheckbox, showJitter);
    setNamedControlVisible(model, controls.jitterLabel, showJitter);
    setNamedControlVisible(model, controls.newConditionInput, useNewCondition);
    setNamedControlEnabled(model, controls.newConditionInput, useNewCondition);

    controls.thresholdLabels.forEach((name, index) => {
        setDialogControlValue(model, name, viewState.thresholdNames[index] || "");
        setDialogControlVisible(model, name, index < viewState.visibleThresholdCount);
    });
    controls.thresholdInputs.forEach((name, index) => {
        setDialogControlValue(model, name, viewState.thresholdValues[index] || "");
        setDialogControlVisible(model, name, index < viewState.visibleThresholdCount);
        setDialogControlEnabled(model, name, index < viewState.visibleThresholdCount);
    });

    setControlNamesVisible(model, [
        controls.shapeLabel,
        controls.shapeSLabel,
        controls.shapeBellLabel,
        controls.directionLabel,
        controls.directionIncLabel,
        controls.directionDecLabel,
        controls.logisticLabel,
        controls.logisticCheckbox,
        controls.ecdfLabel,
        controls.ecdfCheckbox,
        controls.idmLabel,
        controls.idmInput
    ], !crisp);

    setControlNamesVisible(model, [
        controls.shapeFormLabel,
        controls.aboveLabel,
        controls.aboveInput,
        controls.belowLabel,
        controls.belowInput
    ], showShapeForm);

    setDialogControlPlotPayload(model, controls.plot, viewState.previewPayload);
    setDialogControlValue(model, "__syntaxCommand", viewState.validation.command);
};


export const applyQcaXYPlotDialogState = function(
    model: DialogControlModel,
    controls: QcaXYPlotDialogControls,
    state: QcaXYPlotDialogState
): void {
    setDialogControlVisible(model, controls.rotateInput, state.showCases === true);
    setDialogControlVisible(model, controls.rotateLabel, state.showCases === true);
    setDialogControlValue(model, controls.xAxisLabel, state.xAxisLabel);
    setDialogControlVisible(model, controls.xAxisLabel, Boolean(state.xAxisLabel));
    setDialogControlValue(model, controls.yAxisLabel, state.yAxisLabel);
    setDialogControlVisible(model, controls.yAxisLabel, Boolean(state.yAxisLabel));

    controls.measureLabels.forEach((controlName, index) => {
        const label = state.fitLabels[index] || "";
        const measure = splitMeasureLabel(label);

        setDialogControlValue(model, controlName, measure.name);
        setDialogControlVisible(model, controlName, Boolean(label));
    });
    controls.measureValues.forEach((controlName, index) => {
        const label = state.fitLabels[index] || "";
        const measure = splitMeasureLabel(label);

        setDialogControlValue(model, controlName, measure.value);
        setDialogControlVisible(model, controlName, Boolean(label));
    });
    setControlNamesVisible(model, controls.separators, state.fitLabels.length > 0);

    setDialogControlPlotPayload(model, controls.plot, {
        points: state.points,
        xAxisLabel: state.xAxisLabel,
        yAxisLabel: state.yAxisLabel,
        fitLabels: state.fitLabels,
        showGuides: state.showGuides !== false,
        showCases: state.showCases === true,
        fillPoints: state.fillPoints !== false,
        jitterPoints: state.jitterPoints === true,
        caseLabelRotation: state.caseLabelRotation
    });
};


export const qcaDialogControlAdaptersApi = {
    applyQcaCalibrateDialogState,
    applyQcaVennDialogState,
    applyQcaXYPlotDialogState
};
