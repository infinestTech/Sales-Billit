import { ImageResponse } from 'next/og'
 
export const runtime = 'edge'
export const alt = 'Fixel - Professional Mobile Service Management'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'
 
export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1e40af',
          fontSize: 32,
          fontWeight: 600,
        }}
      >
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          marginBottom: 20,
          color: 'white'
        }}>
          <div style={{
            width: 80,
            height: 80,
            backgroundColor: 'white',
            borderRadius: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 20
          }}>
            <div style={{
              width: 60,
              height: 60,
              backgroundColor: '#3b82f6',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: 24,
              fontWeight: 700
            }}>
              B
            </div>
          </div>
          <div style={{ fontSize: 64, fontWeight: 700 }}>
            BillIt
          </div>
        </div>
        
        <div style={{ 
          color: '#bfdbfe', 
          fontSize: 24, 
          textAlign: 'center',
          maxWidth: 800,
          lineHeight: 1.4
        }}>
          Professional Mobile Service Management Platform
        </div>
        
        <div style={{ 
          color: '#93c5fd', 
          fontSize: 20, 
          marginTop: 20,
          textAlign: 'center'
        }}>
          Track • Bill • Manage • Grow Your Business
        </div>
        
        <div style={{
          display: 'flex',
          marginTop: 40,
          gap: 20
        }}>
          <div style={{
            backgroundColor: 'rgba(255,255,255,0.1)',
            padding: '12px 24px',
            borderRadius: 8,
            color: 'white',
            fontSize: 16
          }}>
            📱 Mobile Repair Tracking
          </div>
          <div style={{
            backgroundColor: 'rgba(255,255,255,0.1)',
            padding: '12px 24px', 
            borderRadius: 8,
            color: 'white',
            fontSize: 16
          }}>
            📊 Business Analytics
          </div>
          <div style={{
            backgroundColor: 'rgba(255,255,255,0.1)',
            padding: '12px 24px',
            borderRadius: 8,
            color: 'white',
            fontSize: 16
          }}>
            💼 Inventory Management
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  )
}
