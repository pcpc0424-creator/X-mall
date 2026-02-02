import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest, AdminAuthRequest } from '../types';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET 환경변수가 설정되지 않았습니다.');
  process.exit(1);
}

export const authenticateUser = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: '인증 토큰이 필요합니다.'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      username: string;
      grade: 'dealer' | 'consumer';
      type: string;
    };

    if (decoded.type !== 'user') {
      return res.status(401).json({
        success: false,
        error: '유효하지 않은 토큰입니다.'
      });
    }

    req.user = {
      id: decoded.id,
      username: decoded.username,
      grade: decoded.grade
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: '유효하지 않거나 만료된 토큰입니다.'
    });
  }
};

export const authenticateAdmin = (req: AdminAuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: '관리자 인증 토큰이 필요합니다.'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      username: string;
      role: string;
      type: string;
    };

    if (decoded.type !== 'admin') {
      return res.status(401).json({
        success: false,
        error: '관리자 권한이 필요합니다.'
      });
    }

    req.admin = {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: '유효하지 않거나 만료된 관리자 토큰입니다.'
    });
  }
};

export const dealerOnly = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: '인증이 필요합니다.'
    });
  }

  if (req.user.grade !== 'dealer') {
    return res.status(403).json({
      success: false,
      error: '대리점 회원만 이용 가능한 기능입니다.'
    });
  }

  next();
};

export const generateUserToken = (user: { id: string; username: string; grade: string }): string => {
  return jwt.sign(
    { id: user.id, username: user.username, grade: user.grade, type: 'user' },
    JWT_SECRET,
    { expiresIn: '7d' } as jwt.SignOptions
  );
};

export const generateAdminToken = (admin: { id: string; username: string; role: string }): string => {
  return jwt.sign(
    { id: admin.id, username: admin.username, role: admin.role, type: 'admin' },
    JWT_SECRET,
    { expiresIn: '8h' } as jwt.SignOptions
  );
};
