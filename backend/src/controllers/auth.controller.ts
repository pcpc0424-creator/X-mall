import { Request, Response } from 'express';
import { userService } from '../services/user.service';
import { adminService } from '../services/admin.service';
import { generateUserToken, generateAdminToken } from '../middleware/auth';
import { SignupBody, LoginBody } from '../types';

export class AuthController {
  async signup(req: Request, res: Response) {
    try {
      const data: SignupBody = req.body;

      if (!data.email || !data.password || !data.name || !data.phone) {
        return res.status(400).json({
          success: false,
          error: '이메일, 비밀번호, 이름, 전화번호는 필수입니다.'
        });
      }

      if (data.password.length < 8) {
        return res.status(400).json({
          success: false,
          error: '비밀번호는 최소 8자 이상이어야 합니다.'
        });
      }

      // Validate referrer if provided
      let referrerId: string | undefined;
      if (data.referrer_email) {
        const referrer = await userService.findDealerByEmail(data.referrer_email);
        if (!referrer) {
          return res.status(400).json({
            success: false,
            error: '존재하지 않는 추천인이거나 대리점이 아닙니다.'
          });
        }
        referrerId = referrer.id;
      }

      const user = await userService.createUser(data, 'consumer', referrerId);

      const token = generateUserToken({
        id: user.id,
        email: user.email,
        grade: user.grade
      });

      res.status(201).json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            grade: user.grade
          },
          token
        },
        message: '회원가입이 완료되었습니다.'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async login(req: Request, res: Response) {
    try {
      const { email, password }: LoginBody = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: '이메일과 비밀번호를 입력해주세요.'
        });
      }

      const user = await userService.findByEmail(email);

      if (!user) {
        return res.status(401).json({
          success: false,
          error: '이메일 또는 비밀번호가 일치하지 않습니다.'
        });
      }

      const isValid = await userService.verifyPassword(user, password);

      if (!isValid) {
        return res.status(401).json({
          success: false,
          error: '이메일 또는 비밀번호가 일치하지 않습니다.'
        });
      }

      const token = generateUserToken({
        id: user.id,
        email: user.email,
        grade: user.grade
      });

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            grade: user.grade
          },
          token
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async adminLogin(req: Request, res: Response) {
    try {
      const { email, password }: LoginBody = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: '이메일과 비밀번호를 입력해주세요.'
        });
      }

      const admin = await adminService.findByEmail(email);

      if (!admin) {
        return res.status(401).json({
          success: false,
          error: '관리자 계정을 찾을 수 없습니다.'
        });
      }

      const isValid = await adminService.verifyPassword(admin, password);

      if (!isValid) {
        return res.status(401).json({
          success: false,
          error: '이메일 또는 비밀번호가 일치하지 않습니다.'
        });
      }

      const token = generateAdminToken({
        id: admin.id,
        email: admin.email,
        role: admin.role
      });

      res.json({
        success: true,
        data: {
          admin: {
            id: admin.id,
            email: admin.email,
            name: admin.name,
            role: admin.role
          },
          token
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

export const authController = new AuthController();
