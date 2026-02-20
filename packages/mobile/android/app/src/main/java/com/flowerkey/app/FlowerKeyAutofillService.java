package com.flowerkey.app;

import android.app.assist.AssistStructure;
import android.os.CancellationSignal;
import android.service.autofill.AutofillService;
import android.service.autofill.FillCallback;
import android.service.autofill.FillContext;
import android.service.autofill.FillRequest;
import android.service.autofill.FillResponse;
import android.service.autofill.SaveCallback;
import android.service.autofill.SaveRequest;
import android.service.autofill.Dataset;
import android.view.autofill.AutofillId;
import android.view.autofill.AutofillValue;
import android.widget.RemoteViews;

import java.util.List;

/**
 * 花钥自动填充服务
 * 检测密码框并提供"在花钥中生成"的填充入口
 */
public class FlowerKeyAutofillService extends AutofillService {

    @Override
    public void onFillRequest(FillRequest request, CancellationSignal cancellationSignal, FillCallback callback) {
        List<FillContext> contexts = request.getFillContexts();
        AssistStructure structure = contexts.get(contexts.size() - 1).getStructure();

        AutofillId passwordFieldId = findPasswordField(structure.getWindowNodeAt(0).getRootViewNode());
        if (passwordFieldId == null) {
            callback.onSuccess(null);
            return;
        }

        // 提示用户去花钥生成密码
        RemoteViews presentation = new RemoteViews(getPackageName(), android.R.layout.simple_list_item_1);
        presentation.setTextViewText(android.R.id.text1, "🔑 在花钥中生成密码");

        Dataset dataset = new Dataset.Builder()
                .setValue(passwordFieldId, AutofillValue.forText(""), presentation)
                .build();

        callback.onSuccess(new FillResponse.Builder().addDataset(dataset).build());
    }

    @Override
    public void onSaveRequest(SaveRequest request, SaveCallback callback) {
        callback.onSuccess();
    }

    /** 递归查找密码输入框 */
    private AutofillId findPasswordField(AssistStructure.ViewNode node) {
        if (node.getAutofillType() != android.view.View.AUTOFILL_TYPE_NONE) {
            String hint = node.getAutofillHints() != null && node.getAutofillHints().length > 0
                    ? node.getAutofillHints()[0] : "";
            String inputType = String.valueOf(node.getInputType());
            // 匹配密码类型输入框
            if (hint.contains("password") || (node.getInputType() & 0x80) != 0) {
                return node.getAutofillId();
            }
        }
        for (int i = 0; i < node.getChildCount(); i++) {
            AutofillId found = findPasswordField(node.getChildAt(i));
            if (found != null) return found;
        }
        return null;
    }
}
