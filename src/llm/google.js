var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { requestUrl } from "obsidian";
export function callGoogleAPI(provider, apiKey, model, messages, context, systemPrompt) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        // Build system instruction
        const systemParts = [];
        if (systemPrompt) {
            systemParts.push(systemPrompt);
        }
        if (context) {
            systemParts.push(context);
        }
        // Build contents array (Google Gemini format)
        const contents = [];
        for (const m of messages) {
            contents.push({
                role: m.role === "assistant" ? "model" : "user",
                parts: [{ text: m.content }]
            });
        }
        const requestBody = {
            contents: contents,
        };
        if (systemParts.length > 0) {
            requestBody.systemInstruction = {
                parts: [{ text: systemParts.join("\n\n") }]
            };
        }
        // Normalize baseUrl - remove trailing slash
        const baseUrl = provider.baseUrl.replace(/\/+$/, "");
        // Google uses API key as query parameter
        const response = yield requestUrl({
            url: `${baseUrl}/models/${model}:generateContent?key=${apiKey}`,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
            throw: false,
        });
        if (response.status < 200 || response.status >= 300) {
            throw new Error(`Google API error: ${response.status} - ${response.text}`);
        }
        const data = response.json;
        // Google returns candidates array with parts that can be text or inlineData (images)
        if (data.candidates && ((_b = (_a = data.candidates[0]) === null || _a === void 0 ? void 0 : _a.content) === null || _b === void 0 ? void 0 : _b.parts)) {
            const parts = data.candidates[0].content.parts;
            const resultParts = [];
            for (const part of parts) {
                if (part.text) {
                    // Text content
                    resultParts.push(part.text);
                }
                else if (part.inlineData) {
                    // Image content - convert to Markdown data URL
                    const { mimeType, data: base64Data } = part.inlineData;
                    const dataUrl = `data:${mimeType};base64,${base64Data}`;
                    resultParts.push(`\n\n![Generated Image](${dataUrl})\n\n`);
                }
            }
            return resultParts.join("") || "No response";
        }
        return "No response";
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ29vZ2xlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZ29vZ2xlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQUFBLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFHdEMsTUFBTSxVQUFnQixhQUFhLENBQUMsUUFBd0IsRUFBRSxNQUFjLEVBQUUsS0FBYSxFQUFFLFFBQXVCLEVBQUUsT0FBZSxFQUFFLFlBQW9COzs7UUFDMUosMkJBQTJCO1FBQzNCLE1BQU0sV0FBVyxHQUFhLEVBQUUsQ0FBQztRQUNqQyxJQUFJLFlBQVksRUFBRSxDQUFDO1lBQ2xCLFdBQVcsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDaEMsQ0FBQztRQUNELElBQUksT0FBTyxFQUFFLENBQUM7WUFDYixXQUFXLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQzNCLENBQUM7UUFFRCw4Q0FBOEM7UUFDOUMsTUFBTSxRQUFRLEdBQWtELEVBQUUsQ0FBQztRQUNuRSxLQUFLLE1BQU0sQ0FBQyxJQUFJLFFBQVEsRUFBRSxDQUFDO1lBQzFCLFFBQVEsQ0FBQyxJQUFJLENBQUM7Z0JBQ2IsSUFBSSxFQUFFLENBQUMsQ0FBQyxJQUFJLEtBQUssV0FBVyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLE1BQU07Z0JBQy9DLEtBQUssRUFBRSxDQUFDLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQzthQUM1QixDQUFDLENBQUM7UUFDSixDQUFDO1FBRUQsTUFBTSxXQUFXLEdBQTRCO1lBQzVDLFFBQVEsRUFBRSxRQUFRO1NBQ2xCLENBQUM7UUFFRixJQUFJLFdBQVcsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7WUFDNUIsV0FBVyxDQUFDLGlCQUFpQixHQUFHO2dCQUMvQixLQUFLLEVBQUUsQ0FBQyxFQUFFLElBQUksRUFBRSxXQUFXLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUM7YUFDM0MsQ0FBQztRQUNILENBQUM7UUFFRCw0Q0FBNEM7UUFDNUMsTUFBTSxPQUFPLEdBQUcsUUFBUSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBQ3JELHlDQUF5QztRQUN6QyxNQUFNLFFBQVEsR0FBRyxNQUFNLFVBQVUsQ0FBQztZQUNqQyxHQUFHLEVBQUUsR0FBRyxPQUFPLFdBQVcsS0FBSyx3QkFBd0IsTUFBTSxFQUFFO1lBQy9ELE1BQU0sRUFBRSxNQUFNO1lBQ2QsT0FBTyxFQUFFO2dCQUNSLGNBQWMsRUFBRSxrQkFBa0I7YUFDbEM7WUFDRCxJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUM7WUFDakMsS0FBSyxFQUFFLEtBQUs7U0FDWixDQUFDLENBQUM7UUFFSCxJQUFJLFFBQVEsQ0FBQyxNQUFNLEdBQUcsR0FBRyxJQUFJLFFBQVEsQ0FBQyxNQUFNLElBQUksR0FBRyxFQUFFLENBQUM7WUFDckQsTUFBTSxJQUFJLEtBQUssQ0FBQyxxQkFBcUIsUUFBUSxDQUFDLE1BQU0sTUFBTSxRQUFRLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQztRQUM1RSxDQUFDO1FBRUQsTUFBTSxJQUFJLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQztRQUMzQixxRkFBcUY7UUFDckYsSUFBSSxJQUFJLENBQUMsVUFBVSxLQUFJLE1BQUEsTUFBQSxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQywwQ0FBRSxPQUFPLDBDQUFFLEtBQUssQ0FBQSxFQUFFLENBQUM7WUFDM0QsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDO1lBQy9DLE1BQU0sV0FBVyxHQUFhLEVBQUUsQ0FBQztZQUVqQyxLQUFLLE1BQU0sSUFBSSxJQUFJLEtBQUssRUFBRSxDQUFDO2dCQUMxQixJQUFJLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztvQkFDZixlQUFlO29CQUNmLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUM3QixDQUFDO3FCQUFNLElBQUksSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO29CQUM1QiwrQ0FBK0M7b0JBQy9DLE1BQU0sRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBRSxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUM7b0JBQ3ZELE1BQU0sT0FBTyxHQUFHLFFBQVEsUUFBUSxXQUFXLFVBQVUsRUFBRSxDQUFDO29CQUN4RCxXQUFXLENBQUMsSUFBSSxDQUFDLDBCQUEwQixPQUFPLE9BQU8sQ0FBQyxDQUFDO2dCQUM1RCxDQUFDO1lBQ0YsQ0FBQztZQUVELE9BQU8sV0FBVyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxhQUFhLENBQUM7UUFDOUMsQ0FBQztRQUNELE9BQU8sYUFBYSxDQUFDO0lBQ3RCLENBQUM7Q0FBQSIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IHJlcXVlc3RVcmwgfSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB7IFByb3ZpZGVyQ29uZmlnLCBDaGF0TWVzc2FnZSB9IGZyb20gXCIuLi90eXBlc1wiO1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY2FsbEdvb2dsZUFQSShwcm92aWRlcjogUHJvdmlkZXJDb25maWcsIGFwaUtleTogc3RyaW5nLCBtb2RlbDogc3RyaW5nLCBtZXNzYWdlczogQ2hhdE1lc3NhZ2VbXSwgY29udGV4dDogc3RyaW5nLCBzeXN0ZW1Qcm9tcHQ6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7XG5cdC8vIEJ1aWxkIHN5c3RlbSBpbnN0cnVjdGlvblxuXHRjb25zdCBzeXN0ZW1QYXJ0czogc3RyaW5nW10gPSBbXTtcblx0aWYgKHN5c3RlbVByb21wdCkge1xuXHRcdHN5c3RlbVBhcnRzLnB1c2goc3lzdGVtUHJvbXB0KTtcblx0fVxuXHRpZiAoY29udGV4dCkge1xuXHRcdHN5c3RlbVBhcnRzLnB1c2goY29udGV4dCk7XG5cdH1cblxuXHQvLyBCdWlsZCBjb250ZW50cyBhcnJheSAoR29vZ2xlIEdlbWluaSBmb3JtYXQpXG5cdGNvbnN0IGNvbnRlbnRzOiB7IHJvbGU6IHN0cmluZzsgcGFydHM6IHsgdGV4dDogc3RyaW5nIH1bXSB9W10gPSBbXTtcblx0Zm9yIChjb25zdCBtIG9mIG1lc3NhZ2VzKSB7XG5cdFx0Y29udGVudHMucHVzaCh7XG5cdFx0XHRyb2xlOiBtLnJvbGUgPT09IFwiYXNzaXN0YW50XCIgPyBcIm1vZGVsXCIgOiBcInVzZXJcIixcblx0XHRcdHBhcnRzOiBbeyB0ZXh0OiBtLmNvbnRlbnQgfV1cblx0XHR9KTtcblx0fVxuXG5cdGNvbnN0IHJlcXVlc3RCb2R5OiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9IHtcblx0XHRjb250ZW50czogY29udGVudHMsXG5cdH07XG5cblx0aWYgKHN5c3RlbVBhcnRzLmxlbmd0aCA+IDApIHtcblx0XHRyZXF1ZXN0Qm9keS5zeXN0ZW1JbnN0cnVjdGlvbiA9IHtcblx0XHRcdHBhcnRzOiBbeyB0ZXh0OiBzeXN0ZW1QYXJ0cy5qb2luKFwiXFxuXFxuXCIpIH1dXG5cdFx0fTtcblx0fVxuXG5cdC8vIE5vcm1hbGl6ZSBiYXNlVXJsIC0gcmVtb3ZlIHRyYWlsaW5nIHNsYXNoXG5cdGNvbnN0IGJhc2VVcmwgPSBwcm92aWRlci5iYXNlVXJsLnJlcGxhY2UoL1xcLyskLywgXCJcIik7XG5cdC8vIEdvb2dsZSB1c2VzIEFQSSBrZXkgYXMgcXVlcnkgcGFyYW1ldGVyXG5cdGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgcmVxdWVzdFVybCh7XG5cdFx0dXJsOiBgJHtiYXNlVXJsfS9tb2RlbHMvJHttb2RlbH06Z2VuZXJhdGVDb250ZW50P2tleT0ke2FwaUtleX1gLFxuXHRcdG1ldGhvZDogXCJQT1NUXCIsXG5cdFx0aGVhZGVyczoge1xuXHRcdFx0XCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIsXG5cdFx0fSxcblx0XHRib2R5OiBKU09OLnN0cmluZ2lmeShyZXF1ZXN0Qm9keSksXG5cdFx0dGhyb3c6IGZhbHNlLFxuXHR9KTtcblxuXHRpZiAocmVzcG9uc2Uuc3RhdHVzIDwgMjAwIHx8IHJlc3BvbnNlLnN0YXR1cyA+PSAzMDApIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoYEdvb2dsZSBBUEkgZXJyb3I6ICR7cmVzcG9uc2Uuc3RhdHVzfSAtICR7cmVzcG9uc2UudGV4dH1gKTtcblx0fVxuXG5cdGNvbnN0IGRhdGEgPSByZXNwb25zZS5qc29uO1xuXHQvLyBHb29nbGUgcmV0dXJucyBjYW5kaWRhdGVzIGFycmF5IHdpdGggcGFydHMgdGhhdCBjYW4gYmUgdGV4dCBvciBpbmxpbmVEYXRhIChpbWFnZXMpXG5cdGlmIChkYXRhLmNhbmRpZGF0ZXMgJiYgZGF0YS5jYW5kaWRhdGVzWzBdPy5jb250ZW50Py5wYXJ0cykge1xuXHRcdGNvbnN0IHBhcnRzID0gZGF0YS5jYW5kaWRhdGVzWzBdLmNvbnRlbnQucGFydHM7XG5cdFx0Y29uc3QgcmVzdWx0UGFydHM6IHN0cmluZ1tdID0gW107XG5cblx0XHRmb3IgKGNvbnN0IHBhcnQgb2YgcGFydHMpIHtcblx0XHRcdGlmIChwYXJ0LnRleHQpIHtcblx0XHRcdFx0Ly8gVGV4dCBjb250ZW50XG5cdFx0XHRcdHJlc3VsdFBhcnRzLnB1c2gocGFydC50ZXh0KTtcblx0XHRcdH0gZWxzZSBpZiAocGFydC5pbmxpbmVEYXRhKSB7XG5cdFx0XHRcdC8vIEltYWdlIGNvbnRlbnQgLSBjb252ZXJ0IHRvIE1hcmtkb3duIGRhdGEgVVJMXG5cdFx0XHRcdGNvbnN0IHsgbWltZVR5cGUsIGRhdGE6IGJhc2U2NERhdGEgfSA9IHBhcnQuaW5saW5lRGF0YTtcblx0XHRcdFx0Y29uc3QgZGF0YVVybCA9IGBkYXRhOiR7bWltZVR5cGV9O2Jhc2U2NCwke2Jhc2U2NERhdGF9YDtcblx0XHRcdFx0cmVzdWx0UGFydHMucHVzaChgXFxuXFxuIVtHZW5lcmF0ZWQgSW1hZ2VdKCR7ZGF0YVVybH0pXFxuXFxuYCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJlc3VsdFBhcnRzLmpvaW4oXCJcIikgfHwgXCJObyByZXNwb25zZVwiO1xuXHR9XG5cdHJldHVybiBcIk5vIHJlc3BvbnNlXCI7XG59XG4iXX0=