import { Response } from 'express';
import { userService } from '../services/user.service';
import { pointService } from '../services/point.service';
import { rpayService } from '../services/rpay.service';
import { AuthRequest, AdminAuthRequest } from '../types';

export class UserController {
  // Get current user profile
  async getProfile(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const user = await userService.findById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: '사용자를 찾을 수 없습니다.'
        });
      }

      // Get balances
      const balances = await pointService.getBalances(userId);

      res.json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          grade: user.grade,
          created_at: user.created_at,
          balances
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Admin: Get all users
  async getUsers(req: AdminAuthRequest, res: Response) {
    try {
      const { page, limit, grade, search } = req.query;

      const result = await userService.getUsers({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        grade: grade as 'dealer' | 'consumer' | undefined,
        search: search as string | undefined
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Admin: Get user by ID with balances
  async getUserById(req: AdminAuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const user = await userService.findById(id);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: '사용자를 찾을 수 없습니다.'
        });
      }

      const balances = await pointService.getBalances(id);

      res.json({
        success: true,
        data: {
          ...user,
          password_hash: undefined,
          balances
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Admin: Create user with grade
  async createUser(req: AdminAuthRequest, res: Response) {
    try {
      const { email, password, name, phone, grade } = req.body;

      if (!email || !password || !name || !phone) {
        return res.status(400).json({
          success: false,
          error: '이메일, 비밀번호, 이름, 전화번호는 필수입니다.'
        });
      }

      const user = await userService.createUser(
        { email, password, name, phone },
        grade || 'consumer'
      );

      res.status(201).json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          grade: user.grade
        },
        message: '회원이 등록되었습니다.'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Admin: Update user grade
  async updateGrade(req: AdminAuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { grade } = req.body;

      if (!grade || !['dealer', 'consumer'].includes(grade)) {
        return res.status(400).json({
          success: false,
          error: '유효한 등급을 입력해주세요. (dealer 또는 consumer)'
        });
      }

      const user = await userService.updateGrade(id, grade);

      res.json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          grade: user.grade
        },
        message: '등급이 변경되었습니다.'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Admin: Deactivate user
  async deactivateUser(req: AdminAuthRequest, res: Response) {
    try {
      const { id } = req.params;

      await userService.deactivateUser(id);

      res.json({
        success: true,
        message: '회원이 비활성화되었습니다.'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
}

export const userController = new UserController();
