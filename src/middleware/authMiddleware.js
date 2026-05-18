 import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Role from '../models/Role.js';

const LEGACY_ADMIN_ROLE_ID = '6a01ee94eeadb31b01cee41a';
const DEFAULT_ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@gmail.com').toLowerCase();

export const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
       return res.status(401).json({ success: false, message: 'Not authorized, no token' });
    }

    const secret = process.env.JWT_SECRET || 'your_jwt_secret_key';
     

    const decoded = jwt.verify(token, secret);
    

    const dbUser = await User.findById(decoded.id).select('roleId email');
    if (!dbUser) {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }

    const roleDoc = dbUser.roleId ? await Role.findById(dbUser.roleId).select('roleName') : null;
    const isLegacyAdmin = dbUser.roleId?.toString?.() === LEGACY_ADMIN_ROLE_ID || decoded.roleId?.toString?.() === LEGACY_ADMIN_ROLE_ID;
    const isDefaultAdminEmail = dbUser.email?.toLowerCase?.() === DEFAULT_ADMIN_EMAIL || decoded.email?.toLowerCase?.() === DEFAULT_ADMIN_EMAIL;

    req.user = {
      ...decoded,
      _id: decoded.id,
      roleId: dbUser.roleId?.toString?.() ?? decoded.roleId?.toString?.() ?? decoded.roleId,
      role: decoded.role ?? roleDoc?.roleName?.toLowerCase?.() ?? (isLegacyAdmin || isDefaultAdminEmail ? 'admin' : null),
    };
    next();
  } catch (error) {
    
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid or expired token',
      error: error.message 
    });
  }
};