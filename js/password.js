// 密码保护功能

/**
 * 检查是否设置了密码保护
 * 通过读取页面上嵌入的环境变量来检查
 */
function isPasswordProtected() {
    // 只检查普通密码
    const pwd = window.__ENV__ && window.__ENV__.PASSWORD;
    
    // 检查普通密码是否有效
    return typeof pwd === 'string' && pwd.length === 64 && !/^0+$/.test(pwd);
}

/**
 * 检查是否强制要求设置密码
 * 如果没有设置有效的 PASSWORD，则认为需要强制设置密码
 * 为了安全考虑，所有部署都必须设置密码
 */
function isPasswordRequired() {
    return !isPasswordProtected();
}

/**
 * 强制密码保护检查 - 防止绕过
 * 在关键操作前都应该调用此函数
 */
function ensurePasswordProtection() {
    if (isPasswordRequired()) {
        showPasswordModal();
        throw new Error('Password protection is required');
    }
    if (isPasswordProtected() && !isPasswordVerified()) {
        showPasswordModal();
        throw new Error('Password verification required');
    }
    return true;
}

window.isPasswordProtected = isPasswordProtected;
window.isPasswordRequired = isPasswordRequired;

/**
 * 验证用户输入的密码是否正确（异步，使用SHA-256哈希）
 */
async function verifyPassword(password) {
    try {
        const correctHash = window.__ENV__?.PASSWORD;
        if (!correctHash) return false;

        const inputHash = await sha256(password);
        const isValid = inputHash === correctHash;

        if (isValid) {
            localStorage.setItem(PASSWORD_CONFIG.localStorageKey, JSON.stringify({
                verified: true,
                timestamp: Date.now(),
                passwordHash: correctHash
            }));
        }
        return isValid;
    } catch (error) {
        console.error('验证密码时出错:', error);
        return false;
    }
}

// 验证状态检查
function isPasswordVerified() {
    try {
        if (!isPasswordProtected()) return true;

        const stored = localStorage.getItem(PASSWORD_CONFIG.localStorageKey);
        if (!stored) return false;

        const { timestamp, passwordHash } = JSON.parse(stored);
        const currentHash = window.__ENV__?.PASSWORD;

        return timestamp && passwordHash === currentHash &&
            Date.now() - timestamp < PASSWORD_CONFIG.verificationTTL;
    } catch (error) {
        console.error('检查密码验证状态时出错:', error);
        return false;
    }
}

// 更新全局导出
window.isPasswordProtected = isPasswordProtected;
window.isPasswordRequired = isPasswordRequired;
window.isPasswordVerified = isPasswordVerified;
window.verifyPassword = verifyPassword;
window.ensurePasswordProtection = ensurePasswordProtection;

// SHA-256实现，可用Web Crypto API
async function sha256(message) {
    if (window.crypto && crypto.subtle && crypto.subtle.digest) {
        const msgBuffer = new TextEncoder().encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    // HTTP 下调用原始 js‑sha256
    if (typeof window._jsSha256 === 'function') {
        return window._jsSha256(message);
    }
    throw new Error('No SHA-256 implementation available.');
}

/**
 * 显示密码验证弹窗
 */
function showPasswordModal() {
    const passwordModal = document.getElementById('passwordModal');
    if (passwordModal) {
        // 防止出现豆瓣区域滚动条
        document.getElementById('doubanArea').classList.add('hidden');
        document.getElementById('passwordCancelBtn').classList.add('hidden');

        // 统一显示维护通知，不再区分密码模式
        const title = passwordModal.querySelector('h2');
        const description = passwordModal.querySelector('p');
        const form = passwordModal.querySelector('form');
        const errorMsg = document.getElementById('passwordError');
        
        // 设置统一的标题和描述
        if (title) title.textContent = '网站维护通知';
        if (description) description.innerHTML = '本站已停止维护，请转至乐乐TV的新域名，请点击<a href="https://leletv.776645.xyz" target="_blank" class="text-blue-400 hover:underline text-xl font-bold block text-center">LeLeTV</a>';

        
        // 隐藏密码表单和错误提示
        if (form) form.style.display = 'none';
        if (errorMsg) errorMsg.classList.add('hidden');

        passwordModal.style.display = 'flex';

        // 只有在非强制设置密码模式下才聚焦输入框
        if (!isPasswordRequired()) {
            // 确保输入框获取焦点
            setTimeout(() => {
                const passwordInput = document.getElementById('passwordInput');
                if (passwordInput) {
                    passwordInput.focus();
                }
            }, 100);
        }
    }
}

/**
 * 隐藏密码验证弹窗
 */
function hidePasswordModal() {
    const passwordModal = document.getElementById('passwordModal');
    if (passwordModal) {
        // 隐藏密码错误提示
        hidePasswordError();

        // 清空密码输入框
        const passwordInput = document.getElementById('passwordInput');
        if (passwordInput) passwordInput.value = '';

        passwordModal.style.display = 'none';

        // 如果启用豆瓣区域则显示豆瓣区域
        if (localStorage.getItem('doubanEnabled') === 'true') {
            document.getElementById('doubanArea').classList.remove('hidden');
            initDouban();
        }
    }
}

/**
 * 显示密码错误信息
 */
function showPasswordError() {
    const errorElement = document.getElementById('passwordError');
    if (errorElement) {
        errorElement.classList.remove('hidden');
    }
}

/**
 * 隐藏密码错误信息
 */
function hidePasswordError() {
    const errorElement = document.getElementById('passwordError');
    if (errorElement) {
        errorElement.classList.add('hidden');
    }
}

/**
 * 处理密码提交事件（异步）
 */
async function handlePasswordSubmit() {
    const passwordInput = document.getElementById('passwordInput');
    const password = passwordInput ? passwordInput.value.trim() : '';
    if (await verifyPassword(password)) {
        hidePasswordModal();

        // 触发密码验证成功事件
        document.dispatchEvent(new CustomEvent('passwordVerified'));
    } else {
        showPasswordError();
        if (passwordInput) {
            passwordInput.value = '';
            passwordInput.focus();
        }
    }
}

/**
 * 初始化密码验证系统
 */
function initPasswordProtection() {
    // 如果需要强制设置密码，显示警告弹窗
    if (isPasswordRequired()) {
        showPasswordModal();
        return;
    }
    
    // 如果设置了密码但用户未验证，显示密码输入框
    if (isPasswordProtected() && !isPasswordVerified()) {
        showPasswordModal();
        return;
    }
}

// 在页面加载完成后初始化密码保护
document.addEventListener('DOMContentLoaded', function () {
    initPasswordProtection();
});