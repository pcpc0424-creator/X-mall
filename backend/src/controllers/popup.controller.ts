import { Request, Response } from 'express';
import { pool } from '../config/database';

class PopupController {
    // 활성화된 모든 팝업 가져오기 (프론트엔드용)
    async getActivePopup(req: Request, res: Response) {
        try {
            const result = await pool.query(
                `SELECT id, title, image_url, link_url, height, enabled
                 FROM popup_settings
                 WHERE enabled = true
                 ORDER BY sort_order ASC, id DESC`
            );

            res.json({
                success: true,
                data: result.rows
            });
        } catch (error) {
            console.error('팝업 조회 오류:', error);
            res.json({
                success: true,
                data: []
            });
        }
    }

    // 새 팝업 추가 (관리자용)
    async addPopup(req: Request, res: Response) {
        try {
            const { title, image_url, link_url, height, enabled } = req.body;

            // 현재 최대 sort_order 조회
            const maxOrder = await pool.query('SELECT COALESCE(MAX(sort_order), 0) as max_order FROM popup_settings');
            const newOrder = maxOrder.rows[0].max_order + 1;

            const result = await pool.query(
                `INSERT INTO popup_settings (title, image_url, link_url, height, enabled, sort_order, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
                 RETURNING id`,
                [title || '', image_url || '', link_url || '', height || null, enabled ? true : false, newOrder]
            );

            res.json({
                success: true,
                message: '팝업이 추가되었습니다.',
                data: { id: result.rows[0].id }
            });
        } catch (error) {
            console.error('팝업 추가 오류:', error);
            res.status(500).json({
                success: false,
                message: '팝업 추가에 실패했습니다.'
            });
        }
    }

    // 팝업 수정 (관리자용)
    async updatePopup(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const { title, image_url, link_url, height, enabled } = req.body;

            await pool.query(
                `UPDATE popup_settings
                 SET title = $1, image_url = $2, link_url = $3, height = $4, enabled = $5, updated_at = NOW()
                 WHERE id = $6`,
                [title || '', image_url || '', link_url || '', height || null, enabled ? true : false, id]
            );

            res.json({
                success: true,
                message: '팝업이 수정되었습니다.'
            });
        } catch (error) {
            console.error('팝업 수정 오류:', error);
            res.status(500).json({
                success: false,
                message: '팝업 수정에 실패했습니다.'
            });
        }
    }

    // 팝업 삭제 (관리자용)
    async deletePopup(req: Request, res: Response) {
        try {
            const { id } = req.params;

            await pool.query('DELETE FROM popup_settings WHERE id = $1', [id]);

            res.json({
                success: true,
                message: '팝업이 삭제되었습니다.'
            });
        } catch (error) {
            console.error('팝업 삭제 오류:', error);
            res.status(500).json({
                success: false,
                message: '팝업 삭제에 실패했습니다.'
            });
        }
    }

    // 모든 팝업 목록 가져오기 (관리자용)
    async getPopupSettings(req: Request, res: Response) {
        try {
            const result = await pool.query(
                `SELECT id, title, image_url, link_url, height, enabled, sort_order, created_at, updated_at
                 FROM popup_settings
                 ORDER BY sort_order ASC, id DESC`
            );

            res.json({
                success: true,
                data: result.rows
            });
        } catch (error) {
            console.error('팝업 설정 조회 오류:', error);
            res.status(500).json({
                success: false,
                message: '팝업 설정 조회에 실패했습니다.'
            });
        }
    }

    // 팝업 활성화/비활성화 토글 (관리자용)
    async togglePopup(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const { enabled } = req.body;

            await pool.query(
                `UPDATE popup_settings SET enabled = $1, updated_at = NOW() WHERE id = $2`,
                [enabled ? true : false, id]
            );

            res.json({
                success: true,
                message: enabled ? '팝업이 활성화되었습니다.' : '팝업이 비활성화되었습니다.'
            });
        } catch (error) {
            console.error('팝업 토글 오류:', error);
            res.status(500).json({
                success: false,
                message: '팝업 상태 변경에 실패했습니다.'
            });
        }
    }
}

export const popupController = new PopupController();
