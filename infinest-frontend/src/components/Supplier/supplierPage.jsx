"use client"

import { useState } from "react"
import { Package, UserPlus, RefreshCcw } from "lucide-react"
import AddSupplierModal from "../ProductTable/AddSupplierModal"
import SupplierList from "./SupplierList"

// Supplier page now uses reusable SupplierList component
const SupplierPage = ({ shopId }) => {
	const [showAddModal, setShowAddModal] = useState(false)
	const [refreshSignal, setRefreshSignal] = useState(0)
	const triggerRefresh = () => setRefreshSignal((v) => v + 1)

	return (
		<div className="h-screen bg-white flex flex-col">
			{/* Header */}
			<div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-8 py-6 flex-shrink-0">
				<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
					<div className="flex items-center space-x-3">
						<div className="p-3 bg-white/20 rounded-xl">
							<Package className="h-8 w-8 text-white" />
						</div>
						<div>
							<h2 className="text-2xl font-bold text-white">Suppliers</h2>
							<p className="text-indigo-100">Manage and track all suppliers</p>
						</div>
					</div>

					<div className="flex flex-col sm:flex-row gap-3">
						<button
							onClick={() => setShowAddModal(true)}
							className="bg-white/20 hover:bg-white/30 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center space-x-2 backdrop-blur-sm border border-white/20 hover:border-white/30"
						>
							<UserPlus className="h-5 w-5" />
							<span>Add Supplier</span>
						</button>
						<button
							onClick={triggerRefresh}
							className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center space-x-2 backdrop-blur-sm border border-white/20 hover:border-white/30"
						>
							<RefreshCcw className="h-5 w-5" />
							<span>Refresh</span>
						</button>
					</div>
				</div>
			</div>

			{/* Supplier List */}
			<div className="flex-1 px-8 py-6 overflow-auto bg-white">
				<SupplierList shopId={shopId} refreshSignal={refreshSignal} />
			</div>

			{showAddModal && (
				<AddSupplierModal
					shop_id={shopId}
					onClose={() => setShowAddModal(false)}
					onSuccess={() => {
						setShowAddModal(false)
						triggerRefresh()
					}}
				/>
			)}
		</div>
	)
}

export default SupplierPage

