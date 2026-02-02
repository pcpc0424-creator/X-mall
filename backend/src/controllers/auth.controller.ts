import { Request, Response } from 'express';
import { userService } from '../services/user.service';
import { adminService } from '../services/admin.service';
import { generateUserToken, generateAdminToken } from '../middleware/auth';
import { SignupBody, LoginBody, AdminLoginBody } from '../types';

export class AuthController {
  async signup(req: Request, res: Response) {
    try {
      const data: SignupBody = req.body;

      if (!data.username || !data.password || !data.name || !data.phone || !data.referrer_username) {
        return res.status(400).json({
          success: false,
          error: '아이디, 비밀번호, 이름, 전화번호, 추천인은 필수입니다.'
        });
      }

      // 아이디 유효성 검사 (영문, 숫자만 허용, 4-20자)
      const usernameRegex = /^[a-zA-Z0-9]{4,20}$/;
      if (!usernameRegex.test(data.username)) {
        return res.status(400).json({
          success: false,
          error: '아이디는 4~20자의 영문, 숫자만 사용 가능합니다.'
        });
      }

      if (data.password.length < 8) {
        return res.status(400).json({
          success: false,
          error: '비밀번호는 최소 8자 이상이어야 합니다.'
        });
      }

      // Validate referrer (required)
      const referrer = await userService.findDealerByUsername(data.referrer_username);
      if (!referrer) {
        return res.status(400).json({
          success: false,
          error: '존재하지 않는 추천인이거나 대리점이 아닙니다.'
        });
      }
      const referrerId = referrer.id;

      const user = await userService.createUser(data, 'consumer', referrerId);

      const token = generateUserToken({
        id: user.id,
        username: user.username,
        grade: user.grade
      });

      res.status(201).json({
        success: true,
        data: {
          user: {
            id: user.id,
            username: user.username,
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
      const { username, password }: LoginBody = req.body;

      if (!username || !password) {
        return res.status(400).json({
          success: false,
          error: '아이디와 비밀번호를 입력해주세요.'
        });
      }

      const user = await userService.findByUsername(username);

      if (!user) {
        return res.status(401).json({
          success: false,
          error: '아이디 또는 비밀번호가 일치하지 않습니다.'
        });
      }

      const isValid = await userService.verifyPassword(user, password);

      if (!isValid) {
        return res.status(401).json({
          success: false,
          error: '아이디 또는 비밀번호가 일치하지 않습니다.'
        });
      }

      const token = generateUserToken({
        id: user.id,
        username: user.username,
        grade: user.grade
      });

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            username: user.username,
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
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({
          success: false,
          error: '아이디와 비밀번호를 입력해주세요.'
        });
      }

      const admin = await adminService.findByUsername(username);

      if (!admin) {
        return res.status(401).json({
          success: false,
          error: '아이디 또는 비밀번호가 일치하지 않습니다.'
        });
      }

      const isValid = await adminService.verifyPassword(admin, password);

      if (!isValid) {
        return res.status(401).json({
          success: false,
          error: '아이디 또는 비밀번호가 일치하지 않습니다.'
        });
      }

      const token = generateAdminToken({
        id: admin.id,
        username: admin.username,
        role: admin.role
      });

      res.json({
        success: true,
        data: {
          admin: {
            id: admin.id,
            username: admin.username,
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
