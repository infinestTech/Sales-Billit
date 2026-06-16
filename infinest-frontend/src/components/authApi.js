import axios from 'axios';


const authApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL_AUTH, // http://localhost:5000
  headers: {
    'Content-Type': 'application/json',
  },
});


export default authApi;




