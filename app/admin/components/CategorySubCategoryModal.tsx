import React, { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  IconButton,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { API_BASE_URL } from "../../utils/api";

type CategoryOption = { id: string | number; name: string };

const FRONTEND_KEY = (process.env.NEXT_PUBLIC_FRONTEND_KEY || "").trim();

function withFrontendKey(init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers || {});
  headers.set("X-Frontend-Key", FRONTEND_KEY);
  return { ...init, headers };
}

async function fetchJsonArray<T>(url: string, init?: RequestInit): Promise<T[]> {
  const res = await fetch(url, withFrontendKey(init));
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText} — ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  if (!Array.isArray(data)) {
    throw new Error(`Expected array, got: ${JSON.stringify(data).slice(0, 200)}`);
  }
  return data;
}

function dataURLtoBlob(dataURL: string): Blob | null {
  try {
    const [meta, b64] = dataURL.split(",");
    const contentType =
      meta.match(/data:(.*?);base64/)?.[1] || "application/octet-stream";
    const byteChars = atob(b64);
    const byteNumbers = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: contentType });
  } catch {
    return null;
  }
}

interface CategorySubCategoryModalProps {
  openCategoryModal: boolean;
  openSubCategoryModal: boolean;
  onCloseCategory: () => void;
  onCloseSubCategory: () => void;
  initialCategoryData?: any | null;
  initialSubCategoryData?: any | null;
  reloadData?: () => void;
  /** optional: pre-fetched from parent; used as fallback if we don’t load */
  categories?: CategoryOption[];
}

const CategorySubCategoryModal: React.FC<CategorySubCategoryModalProps> = ({
  openCategoryModal,
  openSubCategoryModal,
  onCloseCategory,
  onCloseSubCategory,
  initialCategoryData = null,
  initialSubCategoryData = null,
  reloadData = () => {},
  categories: categoriesProp = [],
}) => {
  const [categories, setCategories] = useState<CategoryOption[]>(categoriesProp);
  const [categoriesLoaded, setCategoriesLoaded] = useState<boolean>(false);

  // Category fields
  const [categoryTitle, setCategoryTitle] = useState("");
  const [categoryCaption, setCategoryCaption] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [categoryImageAlt, setCategoryImageAlt] = useState("");
  const [categoryImage, setCategoryImage] = useState("");
  const [categoryImageFile, setCategoryImageFile] = useState<File | null>(null);

  // Subcategory fields
  const [subTitle, setSubTitle] = useState("");
  const [subCaption, setSubCaption] = useState("");
  const [subDescription, setSubDescription] = useState("");
  const [subImageAlt, setSubImageAlt] = useState("");
  const [subImage, setSubImage] = useState("");
  const [subImageFile, setSubImageFile] = useState<File | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<
    (string | number)[]
  >([]);

  // Track originals to detect actual change
  const initialCategoryImageRef = useRef<string>("");
  const initialSubImageRef = useRef<string>("");

  const handleImageUpload = (
    event: React.ChangeEvent<HTMLInputElement>,
    previewSetter: (v: string) => void,
    fileSetter: (f: File | null) => void
  ) => {
    const file = event.target.files?.[0] || null;
    fileSetter(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => previewSetter(String(e.target?.result || ""));
      reader.readAsDataURL(file);
    }
  };

  /* ---------- Category: prefill & reset ---------- */
  useEffect(() => {
    if (openCategoryModal && initialCategoryData) {
      setCategoryTitle(initialCategoryData?.name ?? initialCategoryData?.title ?? "");
      const catAlt =
        initialCategoryData?.imageAlt ??
        initialCategoryData?.alt_text ??
        initialCategoryData?.altText ??
        initialCategoryData?.alt ??
        initialCategoryData?.image?.alt_text ??
        initialCategoryData?.images?.[0]?.alt_text ??
        "";
      setCategoryImageAlt(catAlt);

      const catImg =
        initialCategoryData?.image?.url ??
        initialCategoryData?.image ??
        initialCategoryData?.images?.[0]?.url ??
        "";
      setCategoryImage(catImg);
      initialCategoryImageRef.current = catImg || "";

      setCategoryCaption(initialCategoryData?.caption ?? "");
      setCategoryDescription(initialCategoryData?.description ?? "");
      setCategoryImageFile(null);
    } else if (!openCategoryModal) {
      setCategoryTitle("");
      setCategoryCaption("");
      setCategoryDescription("");
      setCategoryImageAlt("");
      setCategoryImage("");
      setCategoryImageFile(null);
      initialCategoryImageRef.current = "";
    }
  }, [openCategoryModal, initialCategoryData]);

  /* ---------- Subcategory: prefill & reset ---------- */
  useEffect(() => {
    if (openSubCategoryModal && initialSubCategoryData) {
      setSubTitle(initialSubCategoryData?.name ?? initialSubCategoryData?.title ?? "");
      const subAlt =
        initialSubCategoryData?.imageAlt ??
        initialSubCategoryData?.alt_text ??
        initialSubCategoryData?.altText ??
        initialSubCategoryData?.alt ??
        initialSubCategoryData?.image?.alt_text ??
        initialSubCategoryData?.images?.[0]?.alt_text ??
        "";
      setSubImageAlt(subAlt);

      const subImg =
        initialSubCategoryData?.image?.url ??
        initialSubCategoryData?.image ??
        initialSubCategoryData?.images?.[0]?.url ??
        "";
      setSubImage(subImg);
      initialSubImageRef.current = subImg || "";

      setSubCaption(initialSubCategoryData?.caption ?? "");
      setSubDescription(initialSubCategoryData?.description ?? "");
      setSelectedCategories(
        (initialSubCategoryData?.selectedCategories ||
        initialSubCategoryData?.category_ids ||
        []
        ).map(String)
      );
      setSubImageFile(null);
    } else if (!openSubCategoryModal) {
      setSubTitle("");
      setSubCaption("");
      setSubDescription("");
      setSubImageAlt("");
      setSubImage("");
      setSelectedCategories([]);
      setSubImageFile(null);
      initialSubImageRef.current = "";
    }
  }, [openSubCategoryModal, initialSubCategoryData]);

  /* ---------- Lazy-load categories only when subcategory modal opens ---------- */
  useEffect(() => {
    const shouldLoad = openSubCategoryModal && !categoriesLoaded;
    if (!shouldLoad) return;

    const run = async () => {
      try {
        const data = await fetchJsonArray<any>(`${API_BASE_URL}/api/show-categories/`);
        const cleaned = data
          .filter((cat: any) => cat?.status !== "hidden")
          .map((cat: any) => ({
            id: cat?.id ?? cat?.category_id,
            name: cat?.name ?? cat?.title,
          }))
          .filter((c: CategoryOption) => c.id != null && c.name);
        setCategories(cleaned);
        setCategoriesLoaded(true);
      } catch (err: any) {
        console.error("Failed to load categories", err);
        setCategories([]);
        toast.error(`Failed to load categories: ${err.message || err}`, {
          position: "top-right",
          autoClose: 5000,
        });
      }
    };

    if (FRONTEND_KEY) run();
    else {
      console.warn("NEXT_PUBLIC_FRONTEND_KEY is missing.");
      toast.warn("Frontend key missing. Set NEXT_PUBLIC_FRONTEND_KEY and restart.", {
        autoClose: 6000,
      });
    }
  }, [openSubCategoryModal, categoriesLoaded]);

  /* ---------- Save helpers ---------- */
  async function postForm(endpoint: string, formData: FormData) {
    const res = await fetch(`${API_BASE_URL}/api/${endpoint}/`, withFrontendKey({
      method: "POST",
      body: formData,
    }));
    const text = await res.text();
    let result: any;
    try {
      result = JSON.parse(text);
    } catch {
      result = { success: false, error: text };
    }
    if (!res.ok) {
      throw new Error(result?.error || `HTTP ${res.status}: ${text.slice(0, 300)}`);
    }
    return result;
  }

  async function appendImageToFormRespectingBackend(
    formData: FormData,
    file: File | null,
    value: string,
    originalValue: string
  ) {
    if (!file && (!value || value === originalValue)) return;

    if (file) {
      formData.append("image", file);
      return;
    }

    if (value && value.startsWith("data:image/")) {
      const blob = dataURLtoBlob(value);
      if (blob) {
        const ext = (blob.type.split("/")[1] || "png").toLowerCase();
        formData.append("image", new File([blob], `upload.${ext}`, { type: blob.type }));
      }
      return;
    }

    if (value) {
      formData.append("image", value);
    }
  }

  /* ---------- Save Category ---------- */
  const saveCategory = async () => {
    if (!categoryTitle.trim()) {
      toast.warn("Category can't be saved. Title is compulsory.", {
        position: "top-right",
        autoClose: 5000,
      });
      return;
    }

    try {
      const formData = new FormData();
      formData.append("name", categoryTitle.trim());
      formData.append("alt_text", categoryImageAlt.trim());
      formData.append("tags", "");
      formData.append("caption", categoryCaption.trim());
      formData.append("description", categoryDescription.trim());

      const catId = String(
        initialCategoryData?.category_id ?? initialCategoryData?.id ?? ""
      ).trim();
      if (catId) formData.append("category_id", catId);

      await appendImageToFormRespectingBackend(
        formData,
        categoryImageFile,
        categoryImage,
        initialCategoryImageRef.current
      );

      const endpoint = initialCategoryData ? "edit-categories" : "save-categories";
      const result = await postForm(endpoint, formData);

      if (result?.success) {
        toast.success(
          <div>
            <p>
              <strong>Saved successfully.</strong>
            </p>
            <p>In case any problem refresh the page again</p>
          </div>
        );
        onCloseCategory();
        reloadData();
      } else {
        throw new Error(
          result?.error || "Unknown Error Occured.  Category can't be saved."
        );
      }
    } catch (err: any) {
      console.error(err);
      toast.warn(err?.message || "An Unknown error occurred. Try restarting backend server.", {
        position: "top-right",
        autoClose: 5000,
      });
    }
  };

  /* ---------- Save SubCategory ---------- */
  const saveSubCategory = async () => {
    if (!subTitle.trim()) {
      toast.warn("Can't Save the Subcategory. Title is required", {
        position: "top-right",
        autoClose: 5000,
      });
      return;
    }
    if (!selectedCategories.length) {
      toast.warn("Subcategory needs to be linked to at least one category.", {
        position: "top-right",
        autoClose: 5000,
      });
      return;
    }

    try {
      const formData = new FormData();
      selectedCategories.forEach((catId) =>
        formData.append("category_ids", String(catId))
      );
      formData.append("name", subTitle.trim());
      formData.append("alt_text", subImageAlt.trim());
      formData.append("tags", "");
      formData.append("caption", subCaption.trim());
      formData.append("description", subDescription.trim());

      await appendImageToFormRespectingBackend(
        formData,
        subImageFile,
        subImage,
        initialSubImageRef.current
      );

      const subId = String(
        initialSubCategoryData?.subcategory_id ?? initialSubCategoryData?.id ?? ""
      ).trim();
      if (subId) formData.append("subcategory_id", subId);

      const endpoint = initialSubCategoryData ? "edit-subcategories" : "save-subcategories";
      const result = await postForm(endpoint, formData);

      if (result?.success) {
        toast.success(
          "SubCategory saved successfully. In case any problem refresh the page again",
          { position: "top-right", autoClose: 5000 }
        );
        onCloseSubCategory();
        reloadData();
      } else {
        throw new Error("Subcategory can't be saved. An unknown error occured.");
      }
    } catch (err: any) {
      console.error(err);
      toast.warn(err?.message || "An Error Occured. Try restart the backend server.", {
        position: "top-right",
        autoClose: 5000,
      });
    }
  };

  return (
    <>
      {/* CATEGORY MODAL */}
      <Dialog open={openCategoryModal} onClose={onCloseCategory} maxWidth="md" fullWidth>
        <div className="flex justify-between items-center px-6 py-4 border-b">
          <h2 className="text-xl font-bold text-[#891F1A]">
            {initialCategoryData ? "Edit Category" : "Add Category"}
          </h2>
          <IconButton onClick={onCloseCategory}>
            <CloseIcon />
          </IconButton>
        </div>
        <DialogContent className="flex flex-col md:flex-row gap-6 bg-white px-6 py-4">
          <div className="border-2 border-dashed border-gray-300 w-full md:w-1/2 h-64 flex items-center justify-center rounded-md overflow-hidden text-gray-400 text-sm">
            {categoryImage ? (
              <img
                src={
                  categoryImage?.startsWith("data:image/") ||
                  categoryImage?.startsWith("http")
                    ? categoryImage
                    : `${API_BASE_URL}${
                        categoryImage?.startsWith("/") ? "" : "/"
                      }${categoryImage}`
                }
                alt={categoryImageAlt || "Preview"}
                className="h-full object-contain"
              />
            ) : (
              "No image selected"
            )}
          </div>
          <div className="w-full md:w-1/2 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-1">
                Category Title *
              </h3>
              <TextField
                fullWidth
                size="small"
                value={categoryTitle}
                onChange={(e) => setCategoryTitle(e.target.value)}
              />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-1">Caption</h3>
              <TextField
                fullWidth
                size="small"
                value={categoryCaption}
                onChange={(e) => setCategoryCaption(e.target.value)}
              />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-1">Description</h3>
              <TextField
                fullWidth
                size="small"
                multiline
                minRows={3}
                value={categoryDescription}
                onChange={(e) => setCategoryDescription(e.target.value)}
              />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-1">
                Image Alt Text
              </h3>
              <TextField
                fullWidth
                size="small"
                value={categoryImageAlt}
                onChange={(e) => setCategoryImageAlt(e.target.value)}
              />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-1">
                Upload Image via URL
              </h3>
              <TextField
                fullWidth
                size="small"
                value={categoryImage}
                onChange={(e) => setCategoryImage(e.target.value)}
              />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-1">
                Upload Image via File
              </h3>
              <input
                type="file"
                accept="image/*"
                onChange={(e) =>
                  handleImageUpload(e as any, setCategoryImage, setCategoryImageFile)
                }
              />
            </div>
          </div>
        </DialogContent>
        <DialogActions className="px-6 pb-4">
          <Button onClick={onCloseCategory}>Cancel</Button>
          <Button onClick={saveCategory} variant="contained" className="bg-[#891F1A] text-white">
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* SUBCATEGORY MODAL */}
      <Dialog open={openSubCategoryModal} onClose={onCloseSubCategory} maxWidth="md" fullWidth>
        <div className="flex justify-between items-center px-6 py-4 border-b">
          <h2 className="text-xl font-bold text-[#891F1A]">
            {initialSubCategoryData ? "Edit Sub Category" : "Add Sub Category"}
          </h2>
          <IconButton onClick={onCloseSubCategory}>
            <CloseIcon />
          </IconButton>
        </div>
        <DialogContent className="flex flex-col md:flex-row gap-6 bg-white px-6 py-4">
          <div className="border-2 border-dashed border-gray-300 w-full md:w-1/2 h-64 flex items-center justify-center rounded-md overflow-hidden text-gray-400 text-sm">
            {subImage ? (
              <img
                src={
                  subImage?.startsWith("data:image/") || subImage?.startsWith("http")
                    ? subImage
                    : `${API_BASE_URL}${subImage?.startsWith("/") ? "" : "/"}${subImage}`
                }
                alt={subImageAlt || "Preview"}
                className="h-full object-contain"
              />
            ) : (
              "No image selected"
            )}
          </div>
          <div className="w-full md:w-1/2 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-1">
                Subcategory Title *
              </h3>
              <TextField
                fullWidth
                size="small"
                value={subTitle}
                onChange={(e) => setSubTitle(e.target.value)}
              />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-1">Caption</h3>
              <TextField
                fullWidth
                size="small"
                value={subCaption}
                onChange={(e) => setSubCaption(e.target.value)}
              />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-1">Description</h3>
              <TextField
                fullWidth
                size="small"
                multiline
                minRows={3}
                value={subDescription}
                onChange={(e) => setSubDescription(e.target.value)}
              />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-1">
                Image Alt Text
              </h3>
              <TextField
                fullWidth
                size="small"
                value={subImageAlt}
                onChange={(e) => setSubImageAlt(e.target.value)}
              />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-1">
                Upload Image via URL
              </h3>
              <TextField
                fullWidth
                size="small"
                value={subImage}
                onChange={(e) => setSubImage(e.target.value)}
              />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-1">
                Upload Image via File
              </h3>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(e as any, setSubImage, setSubImageFile)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Category(s)
              </label>
              <select
                multiple
                value={selectedCategories.map(String)}
                onChange={(e) => {
                  const options = Array.from(e.target.selectedOptions, (o) => o.value);
                  setSelectedCategories(options);
                }}
                className="w-full p-2 border rounded-md bg-white"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={String(cat.id)}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </DialogContent>
        <DialogActions className="px-6 pb-4">
          <Button onClick={onCloseSubCategory}>Cancel</Button>
          <Button onClick={saveSubCategory} variant="contained" className="bg-[#891F1A] text-white">
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default CategorySubCategoryModal;
