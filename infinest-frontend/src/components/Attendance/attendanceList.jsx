import { useEffect, useState } from 'react';
import { CalendarCheck, CheckCircle2, XCircle, UserPlus, Users, Clock } from 'lucide-react';
import api from '@/components/api';

export default function Attendance({ shopId }) {
	const [employees, setEmployees] = useState([]);
	const [attendanceDate, setAttendanceDate] = useState(() => {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
	});
	const [attendanceLoading, setAttendanceLoading] = useState(false);
	const [loading, setLoading] = useState(false);
	const [modalOpen, setModalOpen] = useState(false);
	const [saving, setSaving] = useState(false);
	const [form, setForm] = useState({
		employee_name: '',
		mobile_number: '',
		address: '',
		blood_group: ''
	});

	const resetForm = () => setForm({ employee_name: '', mobile_number: '', address: '', blood_group: '' });

	const getTodayString = () => {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
	};

	const isTodaySelected = attendanceDate === getTodayString();

	const mergeAttendance = (baseEmployees, attendancePayload) => {
		// attendancePayload.data entries may include attendance field if using listTodayAttendance
		return attendancePayload?.data ? attendancePayload.data : baseEmployees;
	};

	const fetchEmployees = async () => {
		if (!shopId) return;
		try {
			setLoading(true);
			const token = localStorage.getItem('token');
			// fetch employees raw
			const resEmp = await api.get(`/api/employees/${shopId}`, { headers: { Authorization: `Bearer ${token}` } });
			let base = resEmp.data?.data || [];
			// fetch today's attendance merged
			setAttendanceLoading(true);
			const resAtt = await api.get(`/api/employees/attendance/${shopId}?date=${attendanceDate}`, { headers: { Authorization: `Bearer ${token}` } });
			setEmployees(mergeAttendance(base, resAtt.data));
		} catch (err) {
			console.error('Error fetching employees or attendance:', err);
		} finally {
			setAttendanceLoading(false);
			setLoading(false);
		}
	};

	useEffect(() => {
		// refetch when shopId or selected date changes
		if (shopId) fetchEmployees();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [shopId, attendanceDate]);

	const handleChange = (e) => {
		const { name, value } = e.target;
		setForm((prev) => ({ ...prev, [name]: value }));
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		if (!form.employee_name || !form.mobile_number) {
			alert('Employee name and mobile number are required');
			return;
		}
		try {
			setSaving(true);
			const token = localStorage.getItem('token');
			const res = await api.post('/api/employees/add', {
				shop_id: shopId,
				employee_name: form.employee_name,
				mobile_number: form.mobile_number,
				address: form.address,
				blood_group: form.blood_group
			}, {
				headers: { Authorization: `Bearer ${token}` }
			});
			if (res.data?.success) {
				resetForm();
				setModalOpen(false);
				fetchEmployees();
			} else {
				alert(res.data?.message || 'Failed to add employee');
			}
		} catch (err) {
			console.error('Add employee error:', err);
			alert(err.response?.data?.message || 'Error adding employee');
		} finally {
			setSaving(false);
		}
	};

	const markAttendance = async (employeeId, status) => {
		try {
			const token = localStorage.getItem('token');
			const res = await api.post('/api/employees/attendance/mark', {
				shop_id: shopId,
				employee_id: employeeId,
				status
			}, { headers: { Authorization: `Bearer ${token}` } });
			if (res.data?.success || res.status === 409) {
				// 409 means already locked; still refresh to reflect state
				await fetchEmployees();
			} else {
				alert(res.data?.message || 'Failed to mark attendance');
			}
		} catch (err) {
			console.error('Mark attendance error:', err);
			alert(err.response?.data?.message || 'Error marking attendance');
		}
	};

	const formatDuration = (seconds) => {
		if (!seconds || seconds <= 0) return '00:00:00';
		const hrs = Math.floor(seconds / 3600);
		const mins = Math.floor((seconds % 3600) / 60);
		const secs = seconds % 60;
		return `${String(hrs).padStart(2,'0')}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
	};

	const startPermission = async (employeeId) => {
		try {
			const token = localStorage.getItem('token');
			const res = await api.post('/api/employees/permission/start', { shop_id: shopId, employee_id: employeeId, date: attendanceDate }, { headers: { Authorization: `Bearer ${token}` } });
			if (res.data?.success) {
				await fetchEmployees();
			} else {
				alert(res.data?.message || 'Failed to start permission');
			}
		} catch (err) {
			console.error('startPermission error:', err);
			alert(err.response?.data?.message || 'Error starting permission');
		}
	};

	const endPermission = async (employeeId) => {
		try {
			const token = localStorage.getItem('token');
			const res = await api.post('/api/employees/permission/end', { shop_id: shopId, employee_id: employeeId, date: attendanceDate }, { headers: { Authorization: `Bearer ${token}` } });
			if (res.data?.success) {
				await fetchEmployees();
			} else {
				alert(res.data?.message || 'Failed to end permission');
			}
		} catch (err) {
			console.error('endPermission error:', err);
			alert(err.response?.data?.message || 'Error ending permission');
		}
	};

	return (
		<div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
			{/* Header Section */}
			<div className="mb-8">
				<div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-2xl shadow-2xl overflow-hidden">
					<div className="px-8 py-6 relative">
						{/* Decorative Elements */}
						<div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32"></div>
						<div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full -ml-24 -mb-24"></div>
						
						<div className="relative flex items-center justify-between">
							<div className="flex items-center space-x-4">
								<div className="p-4 bg-white/20 backdrop-blur-sm rounded-2xl shadow-lg">
									<CalendarCheck className="h-10 w-10 text-white" />
								</div>
								<div>
									<h1 className="text-3xl font-bold text-white mb-1 tracking-tight">Attendance Management</h1>
									<p className="text-blue-100 text-sm flex items-center gap-2">
										<Clock className="h-4 w-4" />
										Track daily employee attendance with ease
									</p>
								</div>
							</div>
							<div className="flex items-center gap-3">
								<label className="text-sm text-white">Date</label>
								<input
									type="date"
									value={attendanceDate}
									onChange={(e) => setAttendanceDate(e.target.value)}
									className="rounded-lg border border-white/30 px-3 py-2 bg-white/10 text-white"
								/>
								<button
									onClick={() => setModalOpen(true)}
									className="flex items-center gap-2 px-5 py-2 bg-white text-indigo-600 font-semibold rounded-xl hover:bg-blue-50 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
								>
									<UserPlus className="h-5 w-5" />
									Add Employee
								</button>
							</div>
						</div>
					</div>
				</div>

				{/* inline date input used instead of popover */}

				{/* Stats Cards */}
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
					<div className="bg-white rounded-xl shadow-md p-5 border border-slate-200 hover:shadow-lg transition-shadow">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-slate-500 text-sm font-medium mb-1">Total Employees</p>
								<p className="text-3xl font-bold text-slate-800">{employees.length}</p>
							</div>
							<div className="p-3 bg-blue-100 rounded-lg">
								<Users className="h-8 w-8 text-blue-600" />
							</div>
						</div>
					</div>
					<div className="bg-white rounded-xl shadow-md p-5 border border-slate-200 hover:shadow-lg transition-shadow">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-slate-500 text-sm font-medium mb-1">Present Today</p>
								<p className="text-3xl font-bold text-green-600">
									{employees.filter(e => e.attendance?.status === 'present').length}
								</p>
							</div>
							<div className="p-3 bg-green-100 rounded-lg">
								<CheckCircle2 className="h-8 w-8 text-green-600" />
							</div>
						</div>
					</div>
					<div className="bg-white rounded-xl shadow-md p-5 border border-slate-200 hover:shadow-lg transition-shadow">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-slate-500 text-sm font-medium mb-1">Absent Today</p>
								<p className="text-3xl font-bold text-red-600">
									{employees.filter(e => e.attendance?.status === 'absent').length}
								</p>
							</div>
							<div className="p-3 bg-red-100 rounded-lg">
								<XCircle className="h-8 w-8 text-red-600" />
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Table Section */}
			{loading ? (
				<div className="flex items-center justify-center py-20">
					<div className="text-center">
						<div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
						<p className="text-slate-600 font-medium">Loading employee data...</p>
					</div>
				</div>
			) : employees.length === 0 ? (
				<div className="bg-white rounded-xl shadow-lg border border-slate-200 p-12 text-center">
					<div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full mb-4">
						<Users className="h-8 w-8 text-slate-400" />
					</div>
					<p className="text-slate-600 text-lg font-medium mb-2">No employees found</p>
					<p className="text-slate-400 text-sm mb-6">Start by adding your first employee to track attendance</p>
					<button
						onClick={() => setModalOpen(true)}
						className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
					>
						<UserPlus className="h-5 w-5" />
						Add First Employee
					</button>
				</div>
			) : (
				<div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
					<div className="overflow-x-auto">
						<table className="min-w-full divide-y divide-slate-200">
							<thead>
								<tr className="bg-gradient-to-r from-slate-50 to-slate-100">
									<th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
										Employee Name
									</th>
									<th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
										Mobile Number
									</th>
									<th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
										Address
									</th>
									<th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
										Blood Group
									</th>
									<th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
										Marked At
									</th>
											<th className="px-6 py-4 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">
												 Attendance Status
											</th>
											<th className="px-6 py-4 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">
												Permission 
											</th>
									<th className="px-6 py-4 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">
										Permission Time
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100">
								{employees.map((emp, index) => {
									const att = emp.attendance;
									return (
										<tr 
											key={emp._id} 
											className={`transition-colors hover:bg-blue-50/50 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}
										>
											<td className="px-6 py-4 whitespace-nowrap">
												<div className="flex items-center">
													<div className="flex-shrink-0 h-10 w-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold shadow-md">
														{emp.employee_name.charAt(0).toUpperCase()}
													</div>
													<div className="ml-4">
														<div className="text-sm font-semibold text-slate-900">{emp.employee_name}</div>
													</div>
												</div>
											</td>
											<td className="px-6 py-4 whitespace-nowrap">
												<div className="text-sm text-slate-700 font-medium">{emp.mobile_number}</div>
											</td>
											<td className="px-6 py-4 whitespace-nowrap">
												<div className="text-sm text-slate-600">{emp.address || <span className="text-slate-400 italic">Not provided</span>}</div>
											</td>
											<td className="px-6 py-4 whitespace-nowrap">
												<div className="text-sm">
													{emp.blood_group ? (
														<span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200">
															{emp.blood_group}
														</span>
													) : (
														<span className="text-slate-400 italic">N/A</span>
													)}
												</div>
											</td>
											<td className="px-6 py-4 whitespace-nowrap">
												<div className="text-sm text-slate-500">{emp.attendance && emp.attendance.created_at ? new Date(emp.attendance.created_at).toLocaleString() : <span className="text-slate-400 italic">Not marked</span>}</div>
												</td>
											<td className="px-6 py-4 whitespace-nowrap text-center">
												{attendanceLoading ? (
													<div className="inline-flex items-center gap-2 text-slate-400 text-xs">
														<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-400"></div>
														Loading...
													</div>
												) : att && att.locked ? (
													<span className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold shadow-sm ${
														att.status === 'present' 
															? 'bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 border border-green-200' 
															: 'bg-gradient-to-r from-red-50 to-rose-50 text-red-700 border border-red-200'
													}`}>
														{att.status === 'present' ? (
															<>
																<CheckCircle2 className="h-5 w-5" />
																Present
															</>
														) : (
															<>
																<XCircle className="h-5 w-5" />
																Absent
															</>
														)}
													</span>
												) : (
													<div className="flex gap-2 justify-center">
														<button
															onClick={() => isTodaySelected && markAttendance(emp._id, 'present')}
															disabled={!isTodaySelected}
															className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg ${isTodaySelected ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-slate-200 text-slate-500 cursor-not-allowed'} transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105`}
														>
														<CheckCircle2 className="h-4 w-4" />
														Present
														</button>
														<button
															onClick={() => isTodaySelected && markAttendance(emp._id, 'absent')}
															disabled={!isTodaySelected}
															className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg ${isTodaySelected ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-slate-200 text-slate-500 cursor-not-allowed'} transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105`}
														>
														<XCircle className="h-4 w-4" />
														Absent
														</button>
													</div>
													)}
											</td>
											<td className="px-6 py-4 whitespace-nowrap text-center">
												{/* Permission start/end button */}
												{emp.permissionSummary?.active ? (
													<button onClick={() => isTodaySelected && endPermission(emp._id)} disabled={!isTodaySelected} className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg ${isTodaySelected ? 'bg-orange-500 text-white hover:bg-orange-600' : 'bg-slate-200 text-slate-500 cursor-not-allowed'}`}>End</button>
												) : (
													<button onClick={() => isTodaySelected && startPermission(emp._id)} disabled={!isTodaySelected} className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg ${isTodaySelected ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-slate-200 text-slate-500 cursor-not-allowed'}`}>Start</button>
												)}
											</td>
											<td className="px-6 py-4 whitespace-nowrap text-center">
												{emp.permissionSummary?.totalSeconds ? (
													<span className="text-sm font-medium text-slate-700">{formatDuration(emp.permissionSummary.totalSeconds)}</span>
												) : (
													<span className="text-slate-400 italic text-sm">00:00:00</span>
												)}
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				</div>
			)}

			{/* Add Employee Modal */}
			{modalOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
					<div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden transform transition-all animate-scaleIn">
						{/* Modal Header */}
						<div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-5 relative">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-3">
									<div className="p-2 bg-white/20 rounded-lg">
										<UserPlus className="h-6 w-6 text-white" />
									</div>
									<h3 className="text-xl font-bold text-white">Add New Employee</h3>
								</div>
								<button
									onClick={() => { setModalOpen(false); resetForm(); }}
									className="p-2 hover:bg-white/20 rounded-lg transition-colors"
								>
									<XCircle className="h-6 w-6 text-white" />
								</button>
							</div>
						</div>

						{/* Modal Body */}
						<form onSubmit={handleSubmit} className="p-6 space-y-5">
							<div>
								<label className="block text-sm font-semibold text-slate-700 mb-2">
									Employee Name <span className="text-red-500">*</span>
								</label>
								<input
									name="employee_name"
									value={form.employee_name}
									onChange={handleChange}
									className="w-full rounded-lg border-2 border-slate-200 px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
									placeholder="Enter full name"
									required
								/>
							</div>

							<div>
								<label className="block text-sm font-semibold text-slate-700 mb-2">
									Mobile Number <span className="text-red-500">*</span>
								</label>
								<input
									name="mobile_number"
									value={form.mobile_number}
									onChange={handleChange}
									type="tel"
									className="w-full rounded-lg border-2 border-slate-200 px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
									placeholder="10-digit mobile number"
									required
								/>
							</div>

							<div>
								<label className="block text-sm font-semibold text-slate-700 mb-2">
									Address
								</label>
								<textarea
									name="address"
									value={form.address}
									onChange={handleChange}
									rows="2"
									className="w-full rounded-lg border-2 border-slate-200 px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all resize-none"
									placeholder="Street, City, State"
								/>
							</div>

							<div>
								<label className="block text-sm font-semibold text-slate-700 mb-2">
									Blood Group
								</label>
								<select
									name="blood_group"
									value={form.blood_group}
									onChange={handleChange}
									className="w-full rounded-lg border-2 border-slate-200 px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all bg-white"
								>
									<option value="">Select blood group</option>
									<option value="A+">A+</option>
									<option value="A-">A-</option>
									<option value="B+">B+</option>
									<option value="B-">B-</option>
									<option value="AB+">AB+</option>
									<option value="AB-">AB-</option>
									<option value="O+">O+</option>
									<option value="O-">O-</option>
								</select>
							</div>

							{/* Modal Footer */}
							<div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
								<button
									type="button"
									onClick={() => { setModalOpen(false); resetForm(); }}
									className="px-6 py-2.5 text-sm font-semibold rounded-lg border-2 border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
								>
									Cancel
								</button>
								<button
									type="submit"
									disabled={saving}
									className="px-6 py-2.5 text-sm font-semibold rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg transform hover:scale-105"
								>
									{saving ? (
										<span className="flex items-center gap-2">
											<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
											Saving...
										</span>
									) : (
										'Save Employee'
									)}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}

			<style jsx>{`
				@keyframes fadeIn {
					from { opacity: 0; }
					to { opacity: 1; }
				}
				@keyframes scaleIn {
					from { transform: scale(0.95); opacity: 0; }
					to { transform: scale(1); opacity: 1; }
				}
				.animate-fadeIn {
					animation: fadeIn 0.2s ease-out;
				}
				.animate-scaleIn {
					animation: scaleIn 0.3s ease-out;
				}
			`}</style>
		</div>
	);
}
