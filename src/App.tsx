import { useState, useRef, ChangeEvent, FormEvent } from "react";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./components/ui/card";
import { Upload, Sparkles, Loader2, ClipboardCopy, Check } from "lucide-react";
// Removed Hono client imports as we're using fetch directly

function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [altText, setAltText] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/jpg",
      ];
      const maxSize = 5 * 1024 * 1024; // 5MB

      if (!allowedTypes.includes(file.type)) {
        setError("Invalid file type. Please upload JPEG, PNG, or WebP.");
        setSelectedFile(null);
        event.target.value = "";
        return;
      }
      if (file.size > maxSize) {
        setError("File size exceeds 5MB limit.");
        setSelectedFile(null);
        event.target.value = "";
        return;
      }

      setSelectedFile(file);
      setAltText("");
      setError(null);
    } else {
      setSelectedFile(null);
      setError(null);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleGenerate = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedFile) {
      setError("Please upload an image file.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setAltText("");

    const formData = new FormData();
    formData.append("image", selectedFile);

    console.log("FormData entries:");
    for (const pair of formData.entries()) {
      console.log(pair[0], pair[1]);
    }

    try {
      const res = await fetch("/api/get-alt", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        let errorMsg = `Error: ${res.status} ${res.statusText}`;
        try {
          const errorData = await res.json();
          if (errorData && errorData.error) {
            errorMsg =
              typeof errorData.error === "string"
                ? errorData.error
                : JSON.stringify(errorData.error);
            if (errorData.details) {
              errorMsg += ` Details: ${JSON.stringify(errorData.details)}`;
            }
          } else {
            errorMsg = `Failed to generate alt text. Status: ${res.status}`;
          }
        } catch (jsonError) {
          console.error("Failed to parse error response JSON:", jsonError);
        }
        setError(errorMsg);
        throw new Error(errorMsg);
      }

      const data = await res.json();
      if (data && data.altText) {
        setAltText(data.altText);
      } else {
        setError("Received an unexpected response format from the server.");
      }
    } catch (err) {
      console.error("Generation failed:", err);
      if (!error) {
        setError(
          err instanceof Error
            ? err.message
            : "An unknown error occurred during generation."
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!altText) return;
    navigator.clipboard
      .writeText(altText)
      .then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000); // Reset after 2 seconds
      })
      .catch((err) => {
        console.error("Failed to copy text: ", err);
        setError("Failed to copy text."); // Provide feedback in case of error
      });
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <form onSubmit={handleGenerate}>
          <CardHeader>
            <CardTitle className="text-center text-2xl font-bold">
              Generate Alt Text
            </CardTitle>
            <CardDescription className="text-center mb-4">
              Upload an image to get its alt text.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                className="w-full flex justify-start"
                onClick={handleUploadClick}
                disabled={isLoading}
              >
                <Upload className="mr-2 h-4 w-4 flex-shrink-0" />
                <span className="truncate flex-grow text-left">
                  {selectedFile
                    ? `Selected: ${selectedFile.name}`
                    : "Upload image"}
                </span>
              </Button>
              <Input
                id="fileUpload"
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileChange}
                accept="image/jpeg,image/png,image/webp,image/jpg"
                disabled={isLoading}
                required
              />
              {error && !selectedFile && (
                <p className="text-sm text-destructive text-center">{error}</p>
              )}
            </div>

            {error && !altText && selectedFile && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}

            {altText && (
              <div className="mt-4 space-y-2 rounded-md border bg-muted p-4 mb-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">
                    Generated Alt Text:
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleCopy}
                    aria-label="Copy alt text"
                    type="button"
                  >
                    {isCopied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <ClipboardCopy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-base font-semibold text-foreground">
                  {altText}
                </p>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || !selectedFile}
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              {isLoading ? "Generating..." : "Generate"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

export default App;
