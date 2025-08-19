"use client";

import { API_BASE_URL } from '../../utils/api';
import { useEffect, useState } from 'react';
import AdminAuthGuard from '../components/AdminAuthGaurd';
import AdminSidebar from '../components/AdminSideBar';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Checkbox from '@mui/material/Checkbox';
import CheckIcon from '@mui/icons-material/Check';
import CategorySubCategoryModal from '../components/CategorySubCategoryModal';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

const FRONTEND_KEY = process.env.NEXT_PUBLIC_FRONTEND_KEY as string;
const CategorySubCategoryModalAny = CategorySubCategoryModal as unknown as React.ComponentType<any>;

const CategorySubcategoryAdminPage = () => {
  const [showSidebar, setShowSidebar] = useState(true);
  const [viewType, setViewType] = useState<'categories' | 'subcategories'>('categories');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [subCategories, setSubCategories] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [openCategoryModal, setOpenCategoryModal] = useState(false);
  const [openSubCategoryModal, setOpenSubCategoryModal] = useState(false);
  const [selectedCategoryData, setSelectedCategoryData] = useState<any>(null);
  const [selectedSubCategoryData, setSelectedSubCategoryData] = useState<any>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [sortOrder, setSortOrder] = useState<'none' | 'asc' | 'desc'>('none');

  const loadData = async () => {
    try {
      const [catRes, subRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/show-categories/`, {
          headers: { 'X-Frontend-Key': FRONTEND_KEY },
        }),
        fetch(`${API_BASE_URL}/api/show-subcategories/`, {
          headers: { 'X-Frontend-Key': FRONTEND_KEY },
        }),
      ]);

      const categories = await catRes.json();
      const subcategories = await subRes.json();

      setCategories(
        categories
          .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
          .map((c: any) => ({
            ...c,
            id: c.id || c.category_id,
            subcategories: c.subcategories?.names || [],
            subCount: c.subcategories?.count || 0,
            productCount: c.products || 0,
            status: c.status,
            image: c.image || '',
            imageAlt: c.imageAlt ?? c.alt_text ?? '',
            caption: c.caption ?? '',
            description: c.description ?? '',
          }))
      );

      setSubCategories(
        subcategories
          .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
          .map((s: any) => ({
            ...s,
            id: s.id || s.subcategory_id,
            parentCategory: s.categories?.join(', '),
            productCount: s.products || 0,
            status: s.status,
            image: s.image || '',
            imageAlt: s.imageAlt ?? s.alt_text ?? '',
            caption: s.caption ?? '',
            description: s.description ?? '',
          }))
      );
    } catch (err) {
      console.error(err);
      toast.error('Failed to load category/subcategory data');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const toggleSelect = (id: any) => {
    const sid = String(id);
    setSelectedIds(prev => (prev.includes(sid) ? prev.filter(x => x !== sid) : [...prev, sid]));
  };

  const handleSelectAllToggle = () => {
    const baseData = viewType === 'categories' ? categories : subCategories;
    const filtered = showHidden ? baseData.filter((i: any) => i.status === 'hidden') : baseData.filter((i: any) => i.status !== 'hidden');
    if (selectAll) {
      setSelectedIds([]);
      setSelectAll(false);
    } else {
      setSelectedIds(filtered.map((i: any) => String(i.id)));
      setSelectAll(true);
    }
  };

  const handleDelete = async () => {
    if (!selectedIds.length) {
      toast.error(`Please select at least one ${viewType === 'categories' ? 'Category' : 'Subcategory'} to delete.`);
      return;
    }

    const confirmDelete = window.confirm(
      viewType === 'categories'
        ? 'Are you sure you want to delete these categories? All subcategories and products related to them (that are NOT shared) will be deleted.'
        : 'Are you sure you want to delete these subcategories? All products related to them (that are NOT shared) will be deleted.'
    );

    if (!confirmDelete) return;

    const endpoint = viewType === 'categories' ? 'delete-categories' : 'delete-subcategories';

    try {
      const res = await fetch(`${API_BASE_URL}/api/${endpoint}/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Frontend-Key': FRONTEND_KEY,
        },
        body: JSON.stringify({ ids: selectedIds, confirm: true }),
      });

      const result = await res.json();

      if (result.confirm) {
        const secondConfirm = window.confirm(result.message);
        if (!secondConfirm) return;

        const res2 = await fetch(`${API_BASE_URL}/api/${endpoint}/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Frontend-Key': FRONTEND_KEY,
          },
          body: JSON.stringify({ ids: selectedIds, confirm: true }),
        });
        const result2 = await res2.json();

        if (result2.success) {
          toast.success('Deleted successfully');
        } else {
          toast.error(result2.error || 'Delete failed');
        }
      } else if (result.success) {
        toast.success('Deleted successfully');
      } else {
        toast.error(result.error || 'Delete failed');
      }

      setSelectedIds([]);
      if (viewType === 'categories') {
        setCategories((prev: any[]) => prev.filter(c => !selectedIds.includes(String(c.id))));
      } else {
        setSubCategories((prev: any[]) => prev.filter(sc => !selectedIds.includes(String(sc.id))));
      }
    } catch (err) {
      console.error(err);
      toast.error('Something went wrong during delete');
    }
  };

  const updateStatus = async (status: 'hidden' | 'visible', singleId?: string) => {
    const idsToUpdate = singleId ? [String(singleId)] : selectedIds;

    if (!idsToUpdate.length) {
      toast.error(
        `Please select at least one ${viewType === 'categories' ? 'Category' : 'Subcategory'} to ${status === 'hidden' ? 'hide' : 'unhide'}.`
      );
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/update_hidden_status/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Frontend-Key': FRONTEND_KEY,
        },
        body: JSON.stringify({ ids: idsToUpdate, type: viewType === 'categories' ? 'category' : 'subcategory', status }),
      });

      const result = await res.json();

      if (result.success) {
        toast.success(`${status === 'hidden' ? 'Hidden' : 'Unhidden'} selected ${viewType === 'categories' ? 'Categories' : 'Subcategories'} successfully`);
        setSelectedIds([]);
        setSelectAll(false);
        loadData();
      } else {
        toast.error(result.error || 'Failed to update visibility status');
      }
    } catch (err) {
      console.error('Visibility update error:', err);
      toast.error('Something went wrong while updating visibility');
    }
  };

  const handleDragEnd = async (result: any) => {
    if (!result.destination) return;

    if (viewType === 'categories') {
      const reordered = Array.from(categories);
      const [moved] = reordered.splice(result.source.index, 1);
      reordered.splice(result.destination.index, 0, moved);
      setCategories(reordered);

      const payload = reordered.map((cat: any, index: number) => ({
        id: cat.id,
        order: index + 1,
      }));

      await fetch(`${API_BASE_URL}/api/update-subcategory-order/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Frontend-Key': FRONTEND_KEY,
        },
        body: JSON.stringify({ ordered_subcategories: payload }),
      });

      toast.success('Category order saved!');
    } else {
      const reordered = Array.from(subCategories);
      const [moved] = reordered.splice(result.source.index, 1);
      reordered.splice(result.destination.index, 0, moved);
      setSubCategories(reordered);

      const payload = reordered.map((sub: any, index: number) => ({
        id: sub.id,
        order: index + 1,
      }));

      await fetch(`${API_BASE_URL}/api/update-subcategory-order/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Frontend-Key': FRONTEND_KEY,
        },
        body: JSON.stringify({ ordered_subcategories: payload }),
      });
      toast.success('Subcategory order saved!');
    }
  };

  const cycleSortOrder = () => {
    setSortOrder(prev => (prev === 'none' ? 'desc' : prev === 'desc' ? 'asc' : 'none'));
  };

  const handleViewEdit = (item: any) => {
    if (viewType === 'categories') {
      setSelectedCategoryData({
        id: item.id,
        title: item.name,
        image: item.image || '',
        imageAlt: item.imageAlt || '',
        caption: item.caption || '',
        description: item.description || '',
      });
      setOpenCategoryModal(true);
    } else {
      setSelectedSubCategoryData({
        id: item.id,
        title: item.name,
        image: item.image || '',
        imageAlt: item.imageAlt || '',
        selectedCategories: item.categories || [],
        caption: item.caption || '',
        description: item.description || '',
      });
      setOpenSubCategoryModal(true);
    }
  };

  const CustomCheckbox = (props: any) => (
    <Checkbox
      {...props}
      icon={<span style={{ border: '2px solid #b91c1c', width: 20, height: 20, borderRadius: 4, display: 'block' }} />}
      checkedIcon={
        <span
          style={{
            backgroundColor: '#b91c1c',
            width: 20,
            height: 20,
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
          }}
        >
          <CheckIcon style={{ fontSize: 18 }} />
        </span>
      }
    />
  );

  const disableActions = selectedIds.length === 0;

  let data = viewType === 'categories' ? [...categories] : [...subCategories];
  data = showHidden ? data.filter(i => i.status === 'hidden') : data.filter(i => i.status !== 'hidden');

  if (sortOrder !== 'none') {
    data.sort((a, b) => {
      const valA = a.productCount || 0;
      const valB = b.productCount || 0;
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });
  }

  return (
    <AdminAuthGuard>
      <div className="flex w-full bg-white text-black min-h-screen">
        {showSidebar && (
          <div className="lg:w-64 w-full">
            <AdminSidebar />
          </div>
        )}
        <div className="flex-1 p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between border-b-2 border-[#891F1A] pb-3">
            <h1 className="text-2xl font-bold text-[#891F1A]">Admin Category Management</h1>
            <div className="flex gap-2 flex-wrap mt-2 lg:mt-0">
              <button onClick={() => setOpenCategoryModal(true)} className="bg-[#891F1A] text-white px-4 py-2 rounded hover:bg-red-800">
                + Add Category
              </button>
              <button onClick={() => setOpenSubCategoryModal(true)} className="bg-[#891F1A] text-white px-4 py-2 rounded hover:bg-red-800">
                + Add Sub Category
              </button>
              <button onClick={cycleSortOrder} className="border border-[#891F1A] text-[#891F1A] px-4 py-2 rounded hover:bg-[#891F1A] hover:text-white">
                Sort: {sortOrder === 'none' ? 'Unsorted' : sortOrder === 'asc' ? 'Low - High' : 'High - Low'}
              </button>
            </div>
          </div>

          <select
            className="border px-4 py-2 rounded w-full md:w-72"
            value={viewType}
            onChange={e => {
              setViewType(e.target.value as 'categories' | 'subcategories');
              setSelectedIds([]);
              setSelectAll(false);
            }}
          >
            <option value="categories">Show all Categories</option>
            <option value="subcategories">Show all Sub Categories</option>
          </select>

          <div className="overflow-x-auto border rounded-xl shadow">
            <table className="min-w-full text-sm text-left">
              <thead className="bg-[#891F1A] text-white text-sm">
                <tr>
                  <th className="p-3 text-center w-12 border-white">
                    <CustomCheckbox checked={selectAll} onChange={handleSelectAllToggle} />
                  </th>
                  <th className="p-3 text-center w-15">ID</th>
                  <th className="p-3 text-center w-15">Thumbnail</th>
                  <th className="p-3 text-left w-50">Name</th>
                  <th className="p-3 text-left">{viewType === 'categories' ? 'Subcategories Count' : 'Category'}</th>
                  <th className="p-3 text-center">Products</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId={viewType}>
                  {provided => (
                    <tbody {...provided.droppableProps} ref={provided.innerRef} className="divide-y">
                      {data.map((item, index) => (
                        <Draggable key={item.id} draggableId={item.id.toString()} index={index}>
                          {(provided, snapshot) => (
                            <tr
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`hover:bg-gray-50 ${snapshot.isDragging ? 'bg-yellow-50' : ''}`}
                            >
                              <td className="p-3 text-center">
                                <CustomCheckbox checked={selectedIds.includes(String(item.id))} onChange={() => toggleSelect(item.id)} />
                              </td>
                              <td className="p-3 text-center">{item.id}</td>
                              <td className="p-3 text-center">
                                <img
                                  src={
                                    item.image?.includes('http')
                                      ? item.image
                                      : `${API_BASE_URL}${item.image?.startsWith('/media') ? '' : '/media/'}${item.image || ''}`
                                  }
                                  onError={e => {
                                    (e.currentTarget as HTMLImageElement).src = '/images/img1.jpg';
                                  }}
                                  alt={item.imageAlt || 'Image not available'}
                                  className="w-10 h-10 rounded object-cover mx-auto"
                                />
                              </td>
                              <td className="p-3">{item.name}</td>
                              <td className="p-3">{viewType === 'categories' ? item.subcategories?.length || 0 : item.parentCategory}</td>
                              <td className="p-3 text-center">{viewType === 'categories' ? item.productCount : item.productCount}</td>
                              <td className="p-3 text-center">
                                {showHidden ? (
                                  <button
                                    onClick={() => updateStatus('visible', String(item.id))}
                                    className="bg-[#891F1A] text-white px-4 py-1 rounded hover:bg-red-800"
                                  >
                                    Unhide
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleViewEdit(item)}
                                    className="bg-[#891F1A] text-white px-4 py-1 rounded hover:bg-red-800"
                                  >
                                    View / Edit
                                  </button>
                                )}
                              </td>
                            </tr>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </tbody>
                  )}
                </Droppable>
              </DragDropContext>
            </table>
          </div>

          <div className="flex flex-wrap justify-end items-center mt-4 text-sm gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <CustomCheckbox checked={selectAll} onChange={handleSelectAllToggle} />
                <span>Select All</span>
              </div>
              <span className="text-gray-700">Selected {selectedIds.length} {viewType}</span>
              <button
                onClick={handleDelete}
                disabled={disableActions}
                className={`px-3 py-1 rounded border text-white ${
                  disableActions ? 'bg-gray-400 border-gray-400 cursor-not-allowed' : 'bg-red-500 border-red-600 hover:bg-red-900'
                }`}
              >
                Delete Selected
              </button>
              <button
                onClick={() => updateStatus(showHidden ? 'visible' : 'hidden')}
                disabled={disableActions}
                className={`px-3 py-1 rounded border text-white ${
                  disableActions
                    ? 'bg-gray-400 border-gray-400 cursor-not-allowed'
                    : showHidden
                    ? 'bg-green-600 border-green-700 hover:bg-green-800'
                    : 'bg-yellow-500 border-yellow-600 hover:bg-yellow-600'
                }`}
              >
                {showHidden ? 'Unhide Selected' : 'Hide Selected'}
              </button>

              <button
                onClick={() => setShowHidden(!showHidden)}
                className={`px-3 py-1 rounded border text-white ${showHidden ? 'bg-red-700 border-red-800' : 'bg-red-500 border-red-600'} hover:opacity-90`}
              >
                {showHidden ? 'Back to All' : 'Show Hidden Items'}
              </button>
            </div>
          </div>

          <CategorySubCategoryModalAny
            openCategoryModal={openCategoryModal}
            openSubCategoryModal={openSubCategoryModal}
            onCloseCategory={() => {
              setOpenCategoryModal(false);
              setSelectedCategoryData(null);
            }}
            onCloseSubCategory={() => {
              setOpenSubCategoryModal(false);
              setSelectedSubCategoryData(null);
            }}
            categories={categories.map((c: any) => ({ id: c.id, name: c.name }))}
            initialCategoryData={selectedCategoryData}
            initialSubCategoryData={selectedSubCategoryData}
            reloadData={loadData}
          />

          <ToastContainer position="top-center" />
        </div>
      </div>
    </AdminAuthGuard>
  );
};

export default CategorySubcategoryAdminPage;