import {
    createQcaExternalCallHostForSession
} from "../qca/qcaExternalCallHost";
import {
    PRODUCT_CONTRIBUTION_CONTRACT_VERSION,
    type ProductContribution
} from "@dialogforge/core";


export const productContribution:
    ProductContribution = {
        id: "DialogQCA",
        dialogForgeProductContract:
            PRODUCT_CONTRIBUTION_CONTRACT_VERSION,
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
