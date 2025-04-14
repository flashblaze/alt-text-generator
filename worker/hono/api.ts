import { Hono } from "hono";
import { z } from "zod";
import { cors } from "hono/cors";

const app = new Hono<{ Bindings: Env }>();

app.use(
    "/api/*",
    cors({
        origin: [
            "https://alt.flashblaze.dev",
            "https://dev.alt.flashblaze.dev",
            "http://localhost:5173",
        ],
    })
);

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
];

const formSchema = z.object({
    image: z
        .instanceof(File)
        .refine(
            (file) => file.size <= MAX_FILE_SIZE,
            `File size must be less than 5MB`
        )
        .refine(
            (file) => ACCEPTED_IMAGE_TYPES.includes(file.type),
            `Only JPEG, PNG, and WebP formats are supported`
        ),
});

app.post("/api/get-alt", async (c) => {
    try {
        // Extract form data
        let formData: FormData;
        try {
            formData = await c.req.formData();
        } catch (parseError) {
            console.error("Failed to parse form data:", parseError);
            return c.json(
                { error: "Failed to parse request body as form data" },
                400
            );
        }

        // Check if image field exists
        const imageFile = formData.get("image") as File | null;
        if (!imageFile) {
            console.error("No image field found in form data");
            return c.json({ error: "Missing image field in form data" }, 400);
        }

        // Validate if it's actually a File object
        if (!(imageFile instanceof File)) {
            console.error("Image field is not a File:", typeof imageFile);
            return c.json({ error: "Image field must be a file" }, 400);
        }

        // Validate file type and size
        const validationResult = formSchema.safeParse({ image: imageFile });
        if (!validationResult.success) {
            const errors = validationResult.error.format();
            console.error("Validation failed:", errors);
            return c.json(
                {
                    error: "Validation failed",
                    details: errors.image?._errors || "Invalid image file",
                },
                400
            );
        }

        // At this point, file is valid

        // Get file data as ArrayBuffer
        let imageData: ArrayBuffer;
        try {
            imageData = await imageFile.arrayBuffer();
        } catch (bufferError) {
            console.error("Failed to read file data:", bufferError);
            return c.json({ error: "Failed to process image file data" }, 500);
        }

        // Call AI model
        try {
            const aiResponse = await c.env.AI.run(
                "@cf/meta/llama-3.2-11b-vision-instruct",
                {
                    prompt:
                        "Create alt text for this image. Use simple language and try to describe the image in detail. Keep it under 1000 characters.",
                    image: Array.from(new Uint8Array(imageData)),
                    stream: false
                },
                {
                    gateway: { id: "alt-text-generator" },
                }
            ) as { response: string };

            // Validate AI response
            if (!aiResponse) {
                console.error("Invalid AI response format:", aiResponse);
                return c.json(
                    {
                        error: "Received unexpected response format from AI model",
                        details: JSON.stringify(aiResponse),
                    },
                    500
                );
            }

            // Success case
            return c.json({ altText: aiResponse.response });
        } catch (aiError) {
            console.error("AI processing error:", aiError);
            const errorMessage =
                aiError instanceof Error ? aiError.message : String(aiError);
            const errorStack =
                aiError instanceof Error ? aiError.stack : "No stack trace";
            console.error("AI Error Details:", errorMessage);
            console.error("AI Error Stack:", errorStack);
            return c.json(
                {
                    error: "Failed to process image with AI model",
                    details: errorMessage,
                },
                500
            );
        }
    } catch (error) {
        console.error("Unhandled exception in request handler:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        const stack = error instanceof Error ? error.stack : "No stack trace";
        console.error("Error stack:", stack);
        return c.json(
            {
                error: "An unexpected error occurred",
                details: message,
            },
            500
        );
    }
});

const routes = app;

export default routes;

export type AppType = typeof routes;
