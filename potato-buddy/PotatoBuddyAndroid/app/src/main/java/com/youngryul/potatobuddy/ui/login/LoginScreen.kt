package com.youngryul.potatobuddy.ui.login

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.youngryul.potatobuddy.data.auth.AuthError
import com.youngryul.potatobuddy.data.auth.AuthRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class LoginUiState(
    val email: String = "",
    val password: String = "",
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val infoMessage: String? = null,
)

class LoginViewModel(
    private val authRepository: AuthRepository,
) : ViewModel() {
    private val _ui = MutableStateFlow(LoginUiState())
    val ui: StateFlow<LoginUiState> = _ui.asStateFlow()

    fun onEmailChange(value: String) = _ui.update { it.copy(email = value, errorMessage = null) }
    fun onPasswordChange(value: String) = _ui.update { it.copy(password = value, errorMessage = null) }

    fun signIn() {
        val state = _ui.value
        if (state.email.isBlank() || state.password.isBlank()) {
            _ui.update { it.copy(errorMessage = "이메일과 비밀번호를 입력해 주세요.") }
            return
        }
        viewModelScope.launch {
            _ui.update { it.copy(isLoading = true, errorMessage = null, infoMessage = null) }
            try {
                authRepository.signIn(state.email, state.password)
            } catch (e: Exception) {
                _ui.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = e.message ?: "로그인에 실패했습니다.",
                    )
                }
                return@launch
            }
            _ui.update { it.copy(isLoading = false) }
        }
    }

    fun signUp() {
        val state = _ui.value
        if (state.email.isBlank() || state.password.isBlank()) {
            _ui.update { it.copy(errorMessage = "이메일과 비밀번호를 입력해 주세요.") }
            return
        }
        viewModelScope.launch {
            _ui.update { it.copy(isLoading = true, errorMessage = null, infoMessage = null) }
            try {
                authRepository.signUp(state.email, state.password)
            } catch (e: AuthError.NeedsEmailConfirmation) {
                _ui.update {
                    it.copy(
                        isLoading = false,
                        infoMessage = e.message,
                    )
                }
                return@launch
            } catch (e: Exception) {
                _ui.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = e.message ?: "회원가입에 실패했습니다.",
                    )
                }
                return@launch
            }
            _ui.update { it.copy(isLoading = false) }
        }
    }

    class Factory(private val authRepository: AuthRepository) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            return LoginViewModel(authRepository) as T
        }
    }
}

@Composable
fun LoginScreen(viewModel: LoginViewModel) {
    val state by viewModel.ui.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = "포실이",
            style = MaterialTheme.typography.headlineLarge,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary,
        )
        Text(
            text = "Android MVP",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier = Modifier.height(28.dp))

        OutlinedTextField(
            value = state.email,
            onValueChange = viewModel::onEmailChange,
            label = { Text("이메일") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
        )
        Spacer(Modifier = Modifier.height(12.dp))
        OutlinedTextField(
            value = state.password,
            onValueChange = viewModel::onPasswordChange,
            label = { Text("비밀번호") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
        )

        state.errorMessage?.let {
            Spacer(Modifier = Modifier.height(8.dp))
            Text(it, color = MaterialTheme.colorScheme.error)
        }
        state.infoMessage?.let {
            Spacer(Modifier = Modifier.height(8.dp))
            Text(it, color = MaterialTheme.colorScheme.primary)
        }

        Spacer(Modifier = Modifier.height(20.dp))
        if (state.isLoading) {
            CircularProgressIndicator()
        } else {
            Button(
                onClick = viewModel::signIn,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("로그인")
            }
            Spacer(Modifier = Modifier.height(8.dp))
            OutlinedButton(
                onClick = viewModel::signUp,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("회원가입")
            }
        }
    }
}
