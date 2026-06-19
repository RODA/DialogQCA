import {
    createQcaExternalCallHostForSession
} from "../qca/qcaExternalCallHost";
import type {
    ProductContribution
} from "dialogforge/shared/core/contracts/productContribution";


export const productContribution:
    ProductContribution = {
        id: "DialogQCA",
        createDialogExternalCallHosts: function(context) {
            return {
                qca: createQcaExternalCallHostForSession({
                    executeRuntimeMethod:
                        context.executeRuntimeMethod
                }, "DialogQCA.dialog")
            };
        }
    };

export const dialogQcaProductContribution = productContribution;

export default productContribution;
