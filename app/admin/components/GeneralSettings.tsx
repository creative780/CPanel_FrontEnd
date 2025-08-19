'use client'
import { useEffect, useState } from 'react'

const GeneralSettings = () => {
  const [form, setForm] = useState({
    siteTitle: '',
    logo: null,
    favicon: null,
    language: 'English',
    timezone: 'Asia/Dubai',
    currency: 'AED',
    taxRate: 5,
    facebook: '',
    instagram: '',
    twitter: '',
  })

  useEffect(() => {
    const fetchSettings = async () => {
      const res = await fetch('/api/settings/general/')
      if (res.ok) {
        const data = await res.json()
        setForm({ ...form, ...data })
      }
    }
    fetchSettings()
  }, [])

  const handleChange = (e: any) => {
    const { name, value, type, files } = e.target
    setForm(prev => ({
      ...prev,
      [name]: type === 'file' ? files[0] : value,
    }))
  }

  const handleSave = async () => {
    const formData = new FormData()
    for (const key in form) formData.append(key, form[key])
    const res = await fetch('/api/settings/general/', { method: 'POST', body: formData })
    alert(res.ok ? 'Settings saved.' : 'Failed to save.')
  }

  return (
    <div className="space-y-10 max-w-4xl text-black">
      {/* SITE SETTINGS */}
      <section className="bg-white p-6 rounded-2xl shadow border border-gray-200">
        <h2 className="text-2xl font-bold text-[#891F1A] mb-4 flex items-center gap-2">⚙️ Site Details</h2>

        <div className="mb-4">
          <label className="block font-medium mb-1">Site Title</label>
          <input
            type="text"
            name="siteTitle"
            value={form.siteTitle}
            onChange={handleChange}
            className="input-field"
            placeholder="Enter your site title"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-medium mb-1">Logo</label>
            <input type="file" name="logo" onChange={handleChange} className="input-field" />
          </div>
          <div>
            <label className="block font-medium mb-1">Favicon</label>
            <input type="file" name="favicon" onChange={handleChange} className="input-field" />
          </div>
        </div>
      </section>

      {/* LOCALIZATION */}
      <section className="bg-white p-6 rounded-2xl shadow border border-gray-200">
        <h2 className="text-2xl font-bold text-[#891F1A] mb-4">🌍 Localization</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-medium mb-1">Language</label>
            <input type="text" name="language" value={form.language} onChange={handleChange} className="input-field" />
          </div>
          <div>
            <label className="block font-medium mb-1">Timezone</label>
            <input type="text" name="timezone" value={form.timezone} onChange={handleChange} className="input-field" />
          </div>
          <div>
            <label className="block font-medium mb-1">Currency</label>
            <input type="text" name="currency" value={form.currency} onChange={handleChange} className="input-field" />
          </div>
          <div>
            <label className="block font-medium mb-1">Tax Rate (%)</label>
            <input
              type="number"
              name="taxRate"
              value={form.taxRate}
              onChange={handleChange}
              className="input-field"
            />
          </div>
        </div>
      </section>

      {/* SOCIAL MEDIA */}
      <section className="bg-white p-6 rounded-2xl shadow border border-gray-200">
        <h2 className="text-2xl font-bold text-[#891F1A] mb-4">🔗 Social Links</h2>

        <div className="space-y-4">
          {['facebook', 'instagram', 'twitter'].map((platform) => (
            <div key={platform}>
              <label className="block font-medium capitalize mb-1">{platform} URL</label>
              <input
                type="url"
                name={platform}
                value={form[platform as keyof typeof form]}
                onChange={handleChange}
                className="input-field"
              />
            </div>
          ))}
        </div>
      </section>

      <div className="pt-2">
        <button onClick={handleSave} className="btn-primary">
          Save General Settings
        </button>
      </div>

      {/* Custom styles */}
      <style jsx>{`
        .input-field {
          width: 100%;
          padding: 0.5rem;
          border-radius: 0.5rem;
          border: 1px solid #d1d5db;
          background: white;
        }

        .btn-primary {
          background: #891f1a;
          color: white;
          padding: 0.6rem 1.5rem;
          border-radius: 0.5rem;
          font-weight: 600;
        }

        .btn-primary:hover {
          background: #6d1915;
        }
      `}</style>
    </div>
  )
}

export default GeneralSettings
