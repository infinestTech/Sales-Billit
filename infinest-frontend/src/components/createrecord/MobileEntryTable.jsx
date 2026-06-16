"use client"
import { useState, useEffect } from 'react'
import { Plus, X, ChevronDown } from 'lucide-react'
import api from '@/components/api'

export default function MobileEntryTable({ rows, setRows }) {
  const [mobileBrands, setMobileBrands] = useState([])
  const [mobileIssues, setMobileIssues] = useState([])
  const [previousModels, setPreviousModels] = useState([])
  const [showBrandModal, setShowBrandModal] = useState(false)
  const [showIssueModal, setShowIssueModal] = useState(false)
  const [newBrandName, setNewBrandName] = useState('')
  const [newIssueName, setNewIssueName] = useState('')
  const [newIssueCategory, setNewIssueCategory] = useState('General')
  const [loading, setLoading] = useState(true)
  const [focusedModelIndex, setFocusedModelIndex] = useState(null)
  const [modelSearchTerm, setModelSearchTerm] = useState({})

  // Get shopId from localStorage token
  const getShopId = () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return null
      const payload = JSON.parse(atob(token.split('.')[1]))
      return payload.shop_id || payload.id
    } catch (error) {
      console.error('Error getting shop ID:', error)
      return null
    }
  }

  // Load mobile brands, issues and previous models
  useEffect(() => {
    loadMobileBrands()
    loadMobileIssues()
    loadPreviousModels()
  }, [])

  const loadPreviousModels = () => {
    try {
      const shopId = getShopId()
      if (!shopId) return
      const stored = localStorage.getItem(`mobile_models_${shopId}`)
      if (stored) {
        setPreviousModels(JSON.parse(stored))
      }
    } catch (error) {
      console.error('Error loading previous models:', error)
    }
  }

  const saveModelToHistory = (model) => {
    if (!model || model.trim() === '') return
    const trimmedModel = model.trim()
    const shopId = getShopId()
    if (!shopId) return

    setPreviousModels(prev => {
      const updated = prev.includes(trimmedModel) ? prev : [...prev, trimmedModel]
      localStorage.setItem(`mobile_models_${shopId}`, JSON.stringify(updated))
      return updated
    })
  }

  const loadMobileBrands = async () => {
    try {
      const shopId = getShopId()
      if (!shopId) {
        console.error('No shop ID found')
        return
      }

      console.log('Loading brands for shop ID:', shopId)
      const token = localStorage.getItem('token')
      const response = await api.get(`/api/mobile-brands/${shopId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      console.log('Brands response:', response.data)
      setMobileBrands(response.data.brands || [])
    } catch (error) {
      console.error('Error loading mobile brands:', error)
      console.error('Error details:', error.response?.data || error.message)
    } finally {
      setLoading(false)
    }
  }

  const loadMobileIssues = async () => {
    try {
      const shopId = getShopId()
      if (!shopId) {
        console.error('No shop ID found')
        return
      }

      console.log('Loading issues for shop ID:', shopId)
      const token = localStorage.getItem('token')
      const response = await api.get(`/api/mobile-issues/${shopId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      console.log('Issues response:', response.data)
      setMobileIssues(response.data.issues || [])
    } catch (error) {
      console.error('Error loading mobile issues:', error)
      console.error('Error details:', error.response?.data || error.message)
    }
  }

  const handleInputChange = (index, event) => {
    const { name, value } = event.target
    const updatedRows = [...rows]
    updatedRows[index][name] = value
    setRows(updatedRows)
  }

  const handleSelectChange = (index, field, value) => {
    const updatedRows = [...rows]
    updatedRows[index][field] = value
    
    // Auto-set date when brand or issue is selected
    if (value.trim() !== "") {
      const today = new Date()
      updatedRows[index].date = today.toISOString().split("T")[0]
    }
    
    setRows(updatedRows)
  }

  const handleAddBrand = async () => {
    if (!newBrandName.trim()) return

    try {
      const shopId = getShopId()
      if (!shopId) return

      const token = localStorage.getItem('token')
      await api.post('/api/mobile-brands', {
        shopId,
        brandName: newBrandName.trim()
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })

      // Reload brands and close modal
      await loadMobileBrands()
      setNewBrandName('')
      setShowBrandModal(false)
      
      // Show success message (optional)
      alert('Brand added successfully!')
    } catch (error) {
      console.error('Error adding brand:', error)
      alert(error.response?.data?.error || 'Error adding brand')
    }
  }

  const handleAddIssue = async () => {
    if (!newIssueName.trim()) return

    try {
      const shopId = getShopId()
      if (!shopId) return

      const token = localStorage.getItem('token')
      await api.post('/api/mobile-issues', {
        shopId,
        issueName: newIssueName.trim(),
        issueCategory: newIssueCategory,
        estimatedRepairTime: 1
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })

      // Reload issues and close modal
      await loadMobileIssues()
      setNewIssueName('')
      setNewIssueCategory('General')
      setShowIssueModal(false)
      
      // Show success message (optional)
      alert('Issue added successfully!')
    } catch (error) {
      console.error('Error adding issue:', error)
      alert(error.response?.data?.error || 'Error adding issue')
    }
  }

  const issueCategories = ['General', 'Display', 'Battery', 'Charging', 'Audio', 'Camera', 'Hardware', 'Software', 'Connectivity', 'Body']

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Loading brands and issues...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-3 xl:px-6 text-left text-sm font-medium text-gray-700 border-b border-gray-200">S.No</th>
              <th className="px-3 py-3 xl:px-6 text-left text-sm font-medium text-gray-700 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <span>Mobile Name</span>
                  <button
                    onClick={() => setShowBrandModal(true)}
                    className="ml-2 p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-full transition-colors"
                    title="Add Custom Brand"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </th>
              <th className="px-3 py-3 xl:px-6 text-left text-sm font-medium text-gray-700 border-b border-gray-200">
                <span>Model</span>
              </th>
              <th className="px-3 py-3 xl:px-6 text-left text-sm font-medium text-gray-700 border-b border-gray-200">
                <span>IMEI No</span>
              </th>
              <th className="px-3 py-3 xl:px-6 text-left text-sm font-medium text-gray-700 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <span>Issues</span>
                  <button
                    onClick={() => setShowIssueModal(true)}
                    className="ml-2 p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-full transition-colors"
                    title="Add Custom Issue"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </th>
              <th className="px-3 py-3 xl:px-6 text-left text-sm font-medium text-gray-700 border-b border-gray-200">Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={index}
                className={`${index % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-gray-100 transition-colors duration-200`}
              >
                <td className="px-3 py-3 xl:px-6 xl:py-4 border-b border-gray-200">
                  <span className="text-sm text-gray-900">{index + 1}</span>
                </td>
                <td className="px-3 py-3 xl:px-6 xl:py-4 border-b border-gray-200">
                  <div className="relative">
                    <select
                      name="description"
                      value={row.description}
                      onChange={(e) => handleSelectChange(index, 'description', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white pr-8"
                    >
                      <option value="">Select Mobile Brand</option>
                      {mobileBrands.map((brand) => (
                        <option key={brand._id} value={brand.brand_name}>
                          {brand.brand_name} {brand.is_custom ? '(Custom)' : ''}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  </div>
                </td>
                <td className="px-3 py-3 xl:px-6 xl:py-4 border-b border-gray-200">
                  <div className="relative">
                    <input
                      type="text"
                      name="model"
                      value={row.model || ''}
                      onChange={(e) => {
                        handleInputChange(index, e)
                        setModelSearchTerm(prev => ({ ...prev, [index]: e.target.value }))
                      }}
                      onFocus={() => setFocusedModelIndex(index)}
                      onBlur={() => {
                        setTimeout(() => {
                          setFocusedModelIndex(null)
                          if (row.model && row.model.trim()) {
                            saveModelToHistory(row.model)
                          }
                        }, 200)
                      }}
                      placeholder="Enter model"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {focusedModelIndex === index && previousModels.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
                        {previousModels
                          .filter(model => 
                            model.toLowerCase().includes((modelSearchTerm[index] || row.model || '').toLowerCase())
                          )
                          .map((model, idx) => (
                            <div
                              key={idx}
                              onClick={() => {
                                const updatedRows = [...rows]
                                updatedRows[index].model = model
                                setRows(updatedRows)
                                setFocusedModelIndex(null)
                              }}
                              className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm text-gray-700"
                            >
                              {model}
                            </div>
                          ))
                        }
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3 xl:px-6 xl:py-4 border-b border-gray-200">
                  <input
                    type="text"
                    name="imei"
                    value={row.imei || ''}
                    onChange={(e) => handleInputChange(index, e)}
                    placeholder="Optional IMEI"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </td>
                <td className="px-3 py-3 xl:px-6 xl:py-4 border-b border-gray-200">
                  <div className="relative">
                    <select
                      name="descriptionIssue"
                      value={row.descriptionIssue}
                      onChange={(e) => handleSelectChange(index, 'descriptionIssue', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white pr-8"
                    >
                      <option value="">Select Issue</option>
                      {mobileIssues.map((issue) => (
                        <option key={issue._id} value={issue.issue_name}>
                          {issue.issue_name} ({issue.issue_category}) {issue.is_custom ? '(Custom)' : ''}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  </div>
                </td>
                <td className="px-3 py-3 xl:px-6 xl:py-4 border-b border-gray-200">
                  <span className="text-sm text-gray-900">{row.date}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Brand Modal */}
      {showBrandModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Add Custom Brand</h3>
              <button
                onClick={() => setShowBrandModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Brand Name
              </label>
              <input
                type="text"
                value={newBrandName}
                onChange={(e) => setNewBrandName(e.target.value)}
                placeholder="Enter brand name"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowBrandModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddBrand}
                disabled={!newBrandName.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Add Brand
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Issue Modal */}
      {showIssueModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Add Custom Issue</h3>
              <button
                onClick={() => setShowIssueModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Issue Name
              </label>
              <input
                type="text"
                value={newIssueName}
                onChange={(e) => setNewIssueName(e.target.value)}
                placeholder="Enter issue name"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <select
                value={newIssueCategory}
                onChange={(e) => setNewIssueCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {issueCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowIssueModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddIssue}
                disabled={!newIssueName.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Add Issue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
